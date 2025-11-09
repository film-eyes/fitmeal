// src/features/settings/SettingsAndCalculator.jsx
import React, { useState } from "react";
import { Trash2, Users, Lock, Unlock } from "lucide-react";

import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";

import { getTargetNutrition, getFormulaTarget } from "../../lib/nutrition";

// --- хелпер: нормализация кастомных КБЖУ с учётом замочков ---
// changedField: 'customKcal' | 'customProtein' | 'customFat' | 'customCarbs' | null
const recalcCustomTargets = (profile, changedField = null) => {
  const {
    lockKcal,
    lockProtein,
    lockFat,
    lockCarbs,
    customKcal,
    customProtein,
    customFat,
    customCarbs,
  } = profile;

  let K = Number(customKcal) || 0;
  let P = Number(customProtein) || 0;
  let F = Number(customFat) || 0;
  let C = Number(customCarbs) || 0;

  // Если всё нули — стартуем с "поддержания по формуле"
  if (!K && !P && !F && !C) {
    const maintenance = getFormulaTarget({
      ...profile,
      nutritionMode: "maintenance",
    });
    K = maintenance.kcal || 0;
    P = maintenance.protein || 0;
    F = maintenance.fat || 0;
    C = maintenance.carbs || 0;
  }

  // Не даём уходить в минус
  P = Math.max(0, P);
  F = Math.max(0, F);
  C = Math.max(0, C);

  const macroKcal = 4 * P + 9 * F + 4 * C;

  const fieldToMacroName = {
    customKcal: "kcal",
    customProtein: "protein",
    customFat: "fat",
    customCarbs: "carbs",
  };
  const changedMacroName = fieldToMacroName[changedField];

  // Если калории не заданы, но есть макросы — подгоняем К под макросы
  if (!K && macroKcal > 0) {
    K = macroKcal;
  }

  let diff = K - macroKcal;

  // Если и так почти совпадает — просто округлить
  if (Math.abs(diff) < 0.5) {
    return {
      ...profile,
      customKcal: Math.round(K),
      customProtein: Math.round(P),
      customFat: Math.round(F),
      customCarbs: Math.round(C),
    };
  }

  // Кого можно крутить (угли → жир → белок)
  const candidates = [];
  if (!lockCarbs) candidates.push("carbs");
  if (!lockFat) candidates.push("fat");
  if (!lockProtein) candidates.push("protein");

  // Не трогаем поле, которое только что меняли
  const adjustable = candidates.filter((name) => name !== changedMacroName);

  if (adjustable.length === 0) {
    // Крутить нечего — подстраиваем калории под макросы
    // (даже если меняли калории и они были залочены)
    K = macroKcal;
  } else {
    const m = adjustable[0];

    if (m === "carbs") {
      C = Math.max(0, C + diff / 4);
    } else if (m === "fat") {
      F = Math.max(0, F + diff / 9);
    } else if (m === "protein") {
      P = Math.max(0, P + diff / 4);
    }

    // ВАЖНО:
    //  - если меняли Ккал — считаем, что Ккал — истина
    //    → оставляем K как ввёл пользователь
    //  - если меняли любой макрос — подгоняем Ккал под макросы
    if (changedMacroName !== "kcal") {
      K = 4 * P + 9 * F + 4 * C;
    }
  }

  return {
    ...profile,
    customKcal: Math.round(K),
    customProtein: Math.round(P),
    customFat: Math.round(F),
    customCarbs: Math.round(C),
  };
};

export default function SettingsAndCalculator({
  settings,
  onUpdateSettings,
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  const updateProfile = (index, updater, changedField = null) => {
    setLocalSettings((prev) => {
      const profiles = [...prev.profiles];
      let p = { ...profiles[index] };
      p = updater(p);

      if (p.useCustomTargets) {
        p = recalcCustomTargets(p, changedField);
      }

      profiles[index] = p;
      return { ...prev, profiles };
    });
  };

  const handleProfileFieldChange = (index, field, value) => {
    // Для обычных полей (имя, вес и т.п.) — просто обновляем.
    const macroFields = [
      "customKcal",
      "customProtein",
      "customFat",
      "customCarbs",
      "lockKcal",
      "lockProtein",
      "lockFat",
      "lockCarbs",
      "useCustomTargets",
    ];

    if (!macroFields.includes(field)) {
      setLocalSettings((prev) => {
        const profiles = [...prev.profiles];
        profiles[index] = {
          ...profiles[index],
          [field]: value,
        };
        return { ...prev, profiles };
      });
      return;
    }

    // Для КБЖУ и замков — через updateProfile с пересчётом
    updateProfile(
      index,
      (p) => {
        let v = value;
        if (
          field === "customKcal" ||
          field === "customProtein" ||
          field === "customFat" ||
          field === "customCarbs"
        ) {
          v = value === "" ? "" : Number(value);
        }

        if (field === "useCustomTargets") {
          const next = {
            ...p,
            useCustomTargets: value,
          };

          // Включили кастомный режим — инициализируем из "поддержания"
          if (value) {
            const maintenance = getFormulaTarget({
              ...next,
              nutritionMode: "maintenance",
            });
            return recalcCustomTargets(
              {
                ...next,
                customKcal: Math.round(maintenance.kcal),
                customProtein: Math.round(maintenance.protein),
                customFat: Math.round(maintenance.fat),
                customCarbs: Math.round(maintenance.carbs),
                lockKcal: false,
                lockProtein: false,
                lockFat: false,
                lockCarbs: false,
              },
              null,
            );
          }

          // Выключили кастом — просто вернём
          return next;
        }

        return {
          ...p,
          [field]: v,
        };
      },
      field,
    );
  };

  const addProfile = () => {
    if (localSettings.profiles.length < 2) {
      const newProfile = {
        id: Date.now(),
        name: `Пользователь ${
          localSettings.profiles.length + 1
        }`,
        weight: 60,
        height: 165,
        age: 25,
        gender: "female",
        activity: 1.375,
        nutritionMode: "maintenance",
        useCustomTargets: false,
        customKcal: "",
        customProtein: "",
        customFat: "",
        customCarbs: "",
        lockKcal: false,
        lockProtein: false,
        lockFat: false,
        lockCarbs: false,
      };
      setLocalSettings((prev) => ({
        ...prev,
        profiles: [...prev.profiles, newProfile],
      }));
    }
  };

  const removeProfile = (index) => {
    if (localSettings.profiles.length > 1) {
      const profileToRemove = localSettings.profiles[index];
      setLocalSettings((prev) => ({
        ...prev,
        profiles: prev.profiles.filter((_, i) => i !== index),
        activeProfileIds: prev.activeProfileIds.filter(
          (id) => id !== profileToRemove.id,
        ),
      }));
    }
  };

  const handleSave = () => onUpdateSettings(localSettings);

  return (
    <Card>
      <h2 className="text-3xl font-bold mb-6">Настройки пользователей</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ЛЕВАЯ КОЛОНКА — профили */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold">Профили</h3>

          {localSettings.profiles.map((profile, index) => {
            const maintenance = getFormulaTarget({
              ...profile,
              nutritionMode: "maintenance",
            });
            const effectiveTarget = getTargetNutrition(profile);

            return (
              <Card key={profile.id} className="bg-white/5">
                <div className="flex justify-between items-center mb-4">
                  <Input
                    className="!text-xl !font-bold !p-0 !bg-transparent !border-0"
                    value={profile.name}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "name",
                        e.target.value,
                      )
                    }
                  />
                  {localSettings.profiles.length > 1 && (
                    <Button
                      onClick={() => removeProfile(index)}
                      className="!p-2 bg-pink-500/50"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>

                {/* Основные параметры */}
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    value={profile.gender}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "gender",
                        e.target.value,
                      )
                    }
                  >
                    <option value="male">Мужчина</option>
                    <option value="female">Женщина</option>
                  </Select>
                  <Input
                    type="number"
                    value={profile.age}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "age",
                        e.target.value,
                      )
                    }
                    placeholder="Возраст"
                  />
                  <Input
                    type="number"
                    value={profile.weight}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "weight",
                        e.target.value,
                      )
                    }
                    placeholder="Вес (кг)"
                  />
                  <Input
                    type="number"
                    value={profile.height}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "height",
                        e.target.value,
                      )
                    }
                    placeholder="Рост (см)"
                  />
                  <Select
                    value={profile.activity}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "activity",
                        e.target.value,
                      )
                    }
                  >
                    <option value="1.2">Сидячий</option>
                    <option value="1.375">Легкая активность</option>
                    <option value="1.55">Средняя</option>
                    <option value="1.725">Высокая</option>
                    <option value="1.9">Экстремальная</option>
                  </Select>
                  <Select
                    value={profile.nutritionMode}
                    onChange={(e) =>
                      handleProfileFieldChange(
                        index,
                        "nutritionMode",
                        e.target.value,
                      )
                    }
                  >
                    <option value="maintenance">Поддержание</option>
                    <option value="cutting">Сушка</option>
                    <option value="bulking">Набор массы</option>
                  </Select>
                </div>

                {/* Переключатель формула / кастом */}
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">
                    Режим расчёта КБЖУ:
                  </p>
                  <div className="flex gap-3 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`mode-${profile.id}`}
                        value="formula"
                        checked={!profile.useCustomTargets}
                        onChange={() =>
                          handleProfileFieldChange(
                            index,
                            "useCustomTargets",
                            false,
                          )
                        }
                      />
                      <span>По формуле</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`mode-${profile.id}`}
                        value="custom"
                        checked={!!profile.useCustomTargets}
                        onChange={() =>
                          handleProfileFieldChange(
                            index,
                            "useCustomTargets",
                            true,
                          )
                        }
                      />
                      <span>Кастомный КБЖУ</span>
                    </label>
                  </div>
                </div>

                {/* Блок кастомных целей */}
                {profile.useCustomTargets && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-white/60">
                      В качестве подсказки плейсхолдеры показывают
                      КБЖУ для <strong>поддержания</strong> по формуле.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {/* Ккал */}
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2">
                          <span>Калории</span>
                          <button
                            type="button"
                            className="text-xs flex items-center gap-1"
                            onClick={() =>
                              handleProfileFieldChange(
                                index,
                                "lockKcal",
                                !profile.lockKcal,
                              )
                            }
                          >
                            {profile.lockKcal ? (
                              <>
                                <Lock size={12} /> залочено
                              </>
                            ) : (
                              <>
                                <Unlock size={12} /> авто
                              </>
                            )}
                          </button>
                        </label>
                        <Input
                          type="number"
                          value={
                            profile.customKcal ?? ""
                          }
                          placeholder={Math.round(
                            maintenance.kcal || 0,
                          ).toString()}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              index,
                              "customKcal",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      {/* Белки */}
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2">
                          <span>Белки (г)</span>
                          <button
                            type="button"
                            className="text-xs flex items-center gap-1"
                            onClick={() =>
                              handleProfileFieldChange(
                                index,
                                "lockProtein",
                                !profile.lockProtein,
                              )
                            }
                          >
                            {profile.lockProtein ? (
                              <>
                                <Lock size={12} /> залочено
                              </>
                            ) : (
                              <>
                                <Unlock size={12} /> авто
                              </>
                            )}
                          </button>
                        </label>
                        <Input
                          type="number"
                          value={
                            profile.customProtein ?? ""
                          }
                          placeholder={Math.round(
                            maintenance.protein || 0,
                          ).toString()}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              index,
                              "customProtein",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      {/* Жиры */}
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2">
                          <span>Жиры (г)</span>
                          <button
                            type="button"
                            className="text-xs flex items-center gap-1"
                            onClick={() =>
                              handleProfileFieldChange(
                                index,
                                "lockFat",
                                !profile.lockFat,
                              )
                            }
                          >
                            {profile.lockFat ? (
                              <>
                                <Lock size={12} /> залочено
                              </>
                            ) : (
                              <>
                                <Unlock size={12} /> авто
                              </>
                            )}
                          </button>
                        </label>
                        <Input
                          type="number"
                          value={
                            profile.customFat ?? ""
                          }
                          placeholder={Math.round(
                            maintenance.fat || 0,
                          ).toString()}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              index,
                              "customFat",
                              e.target.value,
                            )
                          }
                        />
                      </div>

                      {/* Углеводы */}
                      <div className="space-y-1">
                        <label className="flex items-center justify-between gap-2">
                          <span>Углеводы (г)</span>
                          <button
                            type="button"
                            className="text-xs flex items-center gap-1"
                            onClick={() =>
                              handleProfileFieldChange(
                                index,
                                "lockCarbs",
                                !profile.lockCarbs,
                              )
                            }
                          >
                            {profile.lockCarbs ? (
                              <>
                                <Lock size={12} /> залочено
                              </>
                            ) : (
                              <>
                                <Unlock size={12} /> авто
                              </>
                            )}
                          </button>
                        </label>
                        <Input
                          type="number"
                          value={
                            profile.customCarbs ?? ""
                          }
                          placeholder={Math.round(
                            maintenance.carbs || 0,
                          ).toString()}
                          onChange={(e) =>
                            handleProfileFieldChange(
                              index,
                              "customCarbs",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="text-xs text-white/60">
                      <p>
                        Текущий баланс:{" "}
                        <strong>
                          {Math.round(effectiveTarget.kcal)} ккал
                        </strong>{" "}
                        = 4×Б + 9×Ж + 4×У
                      </p>
                    </div>
                  </div>
                )}

                {/* Итоговый блок целей */}
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">
                    Итоговая цель КБЖУ:
                  </p>
                  <p className="text-2xl font-bold text-green-300">
                    {effectiveTarget.kcal.toFixed(0)}{" "}
                    <span className="text-base text-white/80">
                      ккал/день
                    </span>
                  </p>
                  <p>Белки: {effectiveTarget.protein.toFixed(0)} г</p>
                  <p>Жиры: {effectiveTarget.fat.toFixed(0)} г</p>
                  <p>Углеводы: {effectiveTarget.carbs.toFixed(0)} г</p>
                  {profile.useCustomTargets && (
                    <p className="text-xs text-white/60 mt-1">
                      Используется кастомный режим с замочками.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}

          {localSettings.profiles.length < 2 && (
            <Button onClick={addProfile}>
              <Users size={16} /> Добавить профиль
            </Button>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА — просто повтор итогов (как раньше) */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold">
            Резюме по целям КБЖУ
          </h3>
          {localSettings.profiles.map((profile) => {
            const target = getTargetNutrition(profile);
            return (
              <Card key={profile.id} className="bg-white/5">
                <h4 className="text-xl font-bold mb-3">
                  {profile.name}
                </h4>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>
                      {profile.useCustomTargets
                        ? "Кастомные цели"
                        : `Формула (${profile.nutritionMode})`}
                      :
                    </strong>
                  </p>
                  <p className="text-2xl font-bold text-green-300">
                    {target.kcal.toFixed(0)}{" "}
                    <span className="text-base text-white/80">
                      ккал/день
                    </span>
                  </p>
                  <p>Белки: {target.protein.toFixed(0)} г</p>
                  <p>Жиры: {target.fat.toFixed(0)} г</p>
                  <p>Углеводы: {target.carbs.toFixed(0)} г</p>
                </div>
              </Card>
            );
          })}

          <Button
            onClick={handleSave}
            className="w-full bg-blue-500/80 hover:bg-blue-600/80 text-lg"
          >
            Сохранить все настройки
          </Button>
        </div>
      </div>
    </Card>
  );
}