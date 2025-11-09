// src/features/menu/MenuPlanner.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  PlusCircle,
  ShoppingCart,
  Download,
  Copy,
  Trash2,
  Edit,
} from "lucide-react";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";

import {
  calculateIngredientNutrition,
  getTargetNutrition,
  getNutrientClass,
} from "../../lib/nutrition";

// Суммируем КБЖУ, цену и общий вес блюда (1 порция)
const calculateTotalsForDish = (dish, ingredients, portionMultiplier = 1) => {
  if (!dish || !dish.ingredients || dish.ingredients.length === 0) {
    return { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, totalWeight: 0 };
  }

  return dish.ingredients.reduce(
    (totals, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (!ing) return totals;

      // calculateIngredientNutrition уже есть в проекте
      const { kcal, protein, fat, carbs, price, weight } =
        calculateIngredientNutrition(item, ing, portionMultiplier);

      totals.kcal += kcal;
      totals.protein += protein;
      totals.fat += fat;
      totals.carbs += carbs;
      totals.price += price;
      totals.totalWeight += weight;

      return totals;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, totalWeight: 0 }
  );
};

// ---------- helpers для типов элементов меню ----------

const isIngredientItem = (item) =>
  item?.itemType === "ingredient" ||
  (!item?.dishId && !!item?.ingredientId);

const isDishItem = (item) =>
  item?.itemType === "dish" || (!!item?.dishId && !isIngredientItem(item));

// базовые нули
const ZERO_TOTALS = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  price: 0,
  totalWeight: 0,
};

const getDateSuffix = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}_${mm}_${yyyy}`;
};

// считаем КБЖУ и цену для набора ингредиентов блюда (1 "порция" / 1 базовый сет)
function calcDishBaseTotals(dishIngredients, allIngredients) {
  return (dishIngredients || []).reduce(
    (totals, item) => {
      const ing = allIngredients.find((i) => i.id === item.ingredientId);
      const n = calculateIngredientNutrition(item, ing, 1, item.cookingMethod);
      totals.kcal += n.kcal;
      totals.protein += n.protein;
      totals.fat += n.fat;
      totals.carbs += n.carbs;
      totals.price += n.price;
      totals.totalWeight += n.weight;
      return totals;
    },
    { ...ZERO_TOTALS },
  );
}

// какие ингредиенты использовать для конкретного элемента меню
function getDishIngredientsForMenuItem(dish, menuItem) {
  if (menuItem.customIngredients && menuItem.customIngredients.length) {
    return menuItem.customIngredients;
  }
  return (dish?.ingredients || []).map((i) => ({ ...i }));
}

// итог КБЖУ/цены по блюду в меню (с учётом customIngredients + порций/граммов)
function getMealTotalsForDish(dish, allIngredients, menuItem) {
  if (!dish) return { ...ZERO_TOTALS };

  const dishIngredients = getDishIngredientsForMenuItem(dish, menuItem);
  const baseTotals = calcDishBaseTotals(dishIngredients, allIngredients);

  // режим "по граммам" — масштабируем под указанный готовый вес
  if (menuItem.grams) {
    if (!baseTotals.totalWeight) return { ...baseTotals };
    const factor = menuItem.grams / baseTotals.totalWeight;
    return {
      kcal: baseTotals.kcal * factor,
      protein: baseTotals.protein * factor,
      fat: baseTotals.fat * factor,
      carbs: baseTotals.carbs * factor,
      price: baseTotals.price * factor,
      totalWeight: baseTotals.totalWeight * factor,
    };
  }

  // режим "по порциям"
  const portion = menuItem.portion || 1;
  return {
    kcal: baseTotals.kcal * portion,
    protein: baseTotals.protein * portion,
    fat: baseTotals.fat * portion,
    carbs: baseTotals.carbs * portion,
    price: baseTotals.price * portion,
    totalWeight: baseTotals.totalWeight * portion,
  };
}

function getDishLabel(menuItem) {
  if (menuItem.grams) return `${menuItem.grams} г`;
  const portion = menuItem.portion ?? 1;
  return `${portion}x`;
}

function getIngredientLabel(menuItem, ingredient) {
  const unitLabel =
    menuItem.unit === "pieces"
      ? "шт"
      : "г";
  return `${menuItem.quantity} ${unitLabel}`;
}

// ----------------------------------------------------------------------
//                         ОСНОВНОЙ КОМПОНЕНТ
// ----------------------------------------------------------------------

export default function MenuPlanner({
  dishes,
  ingredients,
  weeklyMenu,
  onUpdateMenu,
  settings,
  onUpdateSettings,
  showToast,
}) {
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isShoppingListOpen, setShoppingListOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // модалка редактирования состава блюда в конкретный день
  const [editingDishInstance, setEditingDishInstance] = useState(null);
  // { profileId, dayKey, item }

  const daysOfWeek = {
    monday: "Понедельник",
    tuesday: "Вторник",
    wednesday: "Среда",
    thursday: "Четверг",
    friday: "Пятница",
    saturday: "Суббота",
    sunday: "Воскресенье",
  };

  const handleActiveProfilesChange = (profileId) => {
    const currentActive = settings.activeProfileIds || [];
    const isActive = currentActive.includes(profileId);
    let newActive;

    if (isActive) {
      newActive =
        currentActive.length > 1
          ? currentActive.filter((id) => id !== profileId)
          : currentActive;
    } else {
      newActive = [...currentActive, profileId];
    }

    onUpdateSettings({ ...settings, activeProfileIds: newActive });
  };

  const addDishToDay = (dishId, payload) => {
    if (!selectedDay || !selectedProfileId) return;

    const profileMenu = weeklyMenu[selectedProfileId] || {};
    const dayItems = profileMenu[selectedDay] || [];

    const newMeal = {
      id: Date.now(),
      itemType: "dish",
      dishId,
    };

    if (payload.grams) {
      newMeal.grams = payload.grams;
    } else {
      newMeal.portion = payload.portion ?? 1;
    }

    const newMenu = {
      ...weeklyMenu,
      [selectedProfileId]: {
        ...profileMenu,
        [selectedDay]: [...dayItems, newMeal],
      },
    };

    onUpdateMenu(newMenu);
    setAddModalOpen(false);
  };

  const addIngredientToDay = (ingredientId, quantity, unit) => {
    if (!selectedDay || !selectedProfileId) return;

    const profileMenu = weeklyMenu[selectedProfileId] || {};
    const dayItems = profileMenu[selectedDay] || [];

    const newItem = {
      id: Date.now(),
      itemType: "ingredient",
      ingredientId,
      quantity: parseFloat(quantity) || 0,
      unit,
    };

    const newMenu = {
      ...weeklyMenu,
      [selectedProfileId]: {
        ...profileMenu,
        [selectedDay]: [...dayItems, newItem],
      },
    };

    onUpdateMenu(newMenu);
    setAddModalOpen(false);
  };

  const removeItemFromDay = (profileId, day, itemId) => {
    const profileMenu = weeklyMenu[profileId] || {};
    const updated = (profileMenu[day] || []).filter(
      (item) => item.id !== itemId,
    );

    onUpdateMenu({
      ...weeklyMenu,
      [profileId]: { ...profileMenu, [day]: updated },
    });
  };

  const openAddModal = (profileId, day) => {
    setSelectedProfileId(profileId);
    setSelectedDay(day);
    setAddModalOpen(true);
  };

  const openEditDishInstance = (profileId, dayKey, item) => {
    setEditingDishInstance({ profileId, dayKey, item });
  };

  const saveDishInstanceCustomIngredients = (customIngredients) => {
    if (!editingDishInstance) return;
    const { profileId, dayKey, item } = editingDishInstance;

    const profileMenu = weeklyMenu[profileId] || {};
    const dayItems = profileMenu[dayKey] || [];

    const newDayItems = dayItems.map((it) =>
      it.id === item.id ? { ...it, customIngredients } : it,
    );

    const newMenu = {
      ...weeklyMenu,
      [profileId]: { ...profileMenu, [dayKey]: newDayItems },
    };

    onUpdateMenu(newMenu);
    setEditingDishInstance(null);
  };

 const handleMenuExport = (format) => {
  const dateSuffix = getDateSuffix();
  const activeProfiles = settings.profiles.filter((p) =>
    (settings.activeProfileIds || []).includes(p.id)
  );

  if (format === "pdf") {
    const win = window.open("", "_blank");
    if (!win) {
      showToast("Разреши всплывающие окна для этого сайта");
      return;
    }

    // кэш базовых порций, чтобы не считать одно и то же много раз
    const baseTotalsCache = new Map();
    const getBaseTotals = (dish) => {
      if (!dish) return null;
      if (!baseTotalsCache.has(dish.id)) {
        baseTotalsCache.set(dish.id, calculateTotalsForDish(dish, ingredients, 1));
      }
      return baseTotalsCache.get(dish.id);
    };

    let weekTotalPrice = 0;
    let daySectionsHtml = "";

    Object.entries(daysOfWeek).forEach(([dayKey, dayName]) => {
      let rowsHtml = "";

      // суммарные КБЖУ и цена за день
      const dayTotals = {
        kcal: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        price: 0,
      };

      activeProfiles.forEach((profile) => {
        const dayMenu = (weeklyMenu[profile.id] || {})[dayKey] || [];

        dayMenu.forEach((meal) => {
          const dish = dishes.find((d) => d.id === meal.dishId);
          if (!dish) return;

          const baseTotals = getBaseTotals(dish);
          if (!baseTotals || baseTotals.totalWeight === 0) return;

          // ---- расчёт количества порций ----
          // ожидаем, что:
          //   - если блюдо задаётся порциями → meal.portion (число)
          //   - если в граммах → meal.grams (число)
          let servings = 0;
          let multiplier = 0;

          if (typeof meal.portion === "number" && !Number.isNaN(meal.portion)) {
            servings = meal.portion;
            multiplier = meal.portion;
          } else if (
            typeof meal.grams === "number" &&
            !Number.isNaN(meal.grams) &&
            baseTotals.totalWeight > 0
          ) {
            multiplier = meal.grams / baseTotals.totalWeight; // доля порции
            servings = multiplier;
          } else {
            // на всякий случай: если ничего нет — считаем 1 порцию
            servings = 1;
            multiplier = 1;
          }

          // красиво отображаем количество порций
          const servingsDisplay =
            multiplier === 0
              ? ""
              : +multiplier.toFixed(2) // убираем лишние нули
                  .toString()
                  .replace(/\.00$/, "");

          // ---- пересчёт КБЖУ с учётом multiplier ----
          const totals = {
            kcal: baseTotals.kcal * multiplier,
            protein: baseTotals.protein * multiplier,
            fat: baseTotals.fat * multiplier,
            carbs: baseTotals.carbs * multiplier,
            price: baseTotals.price * multiplier,
          };

          dayTotals.kcal += totals.kcal;
          dayTotals.protein += totals.protein;
          dayTotals.fat += totals.fat;
          dayTotals.carbs += totals.carbs;
          dayTotals.price += totals.price;

          rowsHtml += `
            <tr>
              <td class="profile">${profile.name}</td>
              <td class="dish">${dish.name}</td>
              <td>${servingsDisplay}</td>
              <td>${totals.kcal.toFixed(0)}</td>
              <td>${totals.protein.toFixed(0)}</td>
              <td>${totals.fat.toFixed(0)}</td>
              <td>${totals.carbs.toFixed(0)}</td>
              <td>${totals.price.toFixed(2)} ₽</td>
            </tr>`;
        });
      });

      weekTotalPrice += dayTotals.price;

      if (!rowsHtml) {
        rowsHtml = `
          <tr>
            <td colspan="8" class="empty">Нет приёмов пищи</td>
          </tr>`;
      }

      daySectionsHtml += `
        <section class="day">
          <h2>${dayName}</h2>
          <table>
            <thead>
              <tr>
                <th>Профиль</th>
                <th>Блюдо</th>
                <th>Порций</th>
                <th>Ккал</th>
                <th>Б</th>
                <th>Ж</th>
                <th>У</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="day-total">
            Итого за день: Ккал ${dayTotals.kcal.toFixed(0)} /
            Б ${dayTotals.protein.toFixed(0)} /
            Ж ${dayTotals.fat.toFixed(0)} /
            У ${dayTotals.carbs.toFixed(0)} /
            Цена ${dayTotals.price.toFixed(2)} ₽
          </div>
        </section>`;
    });

    const title = `weekly_menu_${dateSuffix}`;

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
                   system-ui, sans-serif;
      background: #f5f5fa;
      color: #111827;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 4px;
    }
    .subtitle {
      margin-bottom: 20px;
      font-size: 13px;
      color: #6b7280;
    }
    .day {
      margin-bottom: 24px;
      padding: 16px 18px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
    }
    .day h2 {
      margin: 0 0 10px;
      font-size: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border-radius: 12px;
      overflow: hidden;
    }
    thead {
      background: #e5f5ff;
    }
    th, td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    td.profile {
      font-weight: 600;
    }
    td.dish {
      font-weight: 500;
    }
    td.empty {
      text-align: center;
      color: #9ca3af;
      font-style: italic;
    }
    .day-total {
      margin-top: 8px;
      font-size: 13px;
      font-weight: 600;
      text-align: right;
      color: #111827;
    }
    .week-total {
      margin-top: 8px;
      font-size: 14px;
      font-weight: 700;
      text-align: right;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Недельное меню</h1>
    <div class="subtitle">Сгенерировано: ${dateSuffix.replace(/_/g, ".")}</div>
    ${daySectionsHtml}
    <div class="week-total">
      Итого за неделю: ${weekTotalPrice.toFixed(2)} ₽
    </div>
  </div>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } else if (format === "text") {
    // текстовый экспорт — оставляем близко к тому, что был
    let text = "";
    Object.entries(daysOfWeek).forEach(([dayKey, dayName]) => {
      text += `--- ${dayName.toUpperCase()} ---\n`;
      activeProfiles.forEach((profile) => {
        text += `\n** ${profile.name} **\n`;
        const dayMenu = (weeklyMenu[profile.id] || {})[dayKey] || [];

        if (dayMenu.length === 0) {
          text += "Нет приёмов пищи\n";
        } else {
          dayMenu.forEach((meal) => {
            const dish = dishes.find((d) => d.id === meal.dishId);
            if (!dish) return;

            const baseTotals = calculateTotalsForDish(dish, ingredients, 1);
            if (!baseTotals || baseTotals.totalWeight === 0) return;

            let multiplier = 1;

            if (typeof meal.portion === "number" && !Number.isNaN(meal.portion)) {
              multiplier = meal.portion;
            } else if (
              typeof meal.grams === "number" &&
              !Number.isNaN(meal.grams) &&
              baseTotals.totalWeight > 0
            ) {
              multiplier = meal.grams / baseTotals.totalWeight;
            }

            const totals = {
              kcal: baseTotals.kcal * multiplier,
              protein: baseTotals.protein * multiplier,
              fat: baseTotals.fat * multiplier,
              carbs: baseTotals.carbs * multiplier,
              price: baseTotals.price * multiplier,
            };

            text += `- ${dish.name} (${multiplier.toFixed(2)} порции): К:${totals.kcal.toFixed(
              0
            )} Б:${totals.protein.toFixed(0)} Ж:${totals.fat.toFixed(
              0
            )} У:${totals.carbs.toFixed(0)} Цена:${totals.price.toFixed(2)} ₽\n`;
          });
        }
      });
      text += "\n";
    });

    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Меню скопировано!"));
  }
};

  const activeProfiles = settings.profiles.filter((p) =>
    (settings.activeProfileIds || []).includes(p.id),
  );

  return (
    <div>
      <MenuControls
        settings={settings}
        onActiveProfilesChange={handleActiveProfilesChange}
        onShoppingListClick={() => setShoppingListOpen(true)}
        onMenuExport={handleMenuExport}
      />

      {isAddModalOpen && (
        <AddMenuItemModal
          dishes={dishes}
          ingredients={ingredients}
          onAddDish={addDishToDay}
          onAddIngredient={addIngredientToDay}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {isShoppingListOpen && (
        <ShoppingList
          weeklyMenu={weeklyMenu}
          dishes={dishes}
          ingredients={ingredients}
          settings={settings}
          onClose={() => setShoppingListOpen(false)}
          showToast={showToast}
        />
      )}

      {editingDishInstance && (
        <EditMenuDishModal
          dish={dishes.find(
            (d) => d.id === editingDishInstance.item.dishId,
          )}
          menuItem={editingDishInstance.item}
          ingredients={ingredients}
          onSave={saveDishInstanceCustomIngredients}
          onClose={() => setEditingDishInstance(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {Object.entries(daysOfWeek).map(([dayKey, dayName]) => (
          <Card key={dayKey}>
            <h3 className="text-2xl font-bold mb-3 text-center">
              {dayName}
            </h3>
            <div
              className={`grid gap-4 ${
                activeProfiles.length > 1 ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {activeProfiles.map((profile) => (
                <DayCard
                  key={profile.id}
                  profile={profile}
                  dayKey={dayKey}
                  dishes={dishes}
                  ingredients={ingredients}
                  dayMenu={(weeklyMenu[profile.id] || {})[dayKey] || []}
                  onAddItem={() => openAddModal(profile.id, dayKey)}
                  onRemoveItem={(itemId) =>
                    removeItemFromDay(profile.id, dayKey, itemId)
                  }
                  onEditDishInstance={(item) =>
                    openEditDishInstance(profile.id, dayKey, item)
                  }
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
//                         UI: панель управления
// ----------------------------------------------------------------------

function MenuControls({
  settings,
  onActiveProfilesChange,
  onShoppingListClick,
  onMenuExport,
}) {
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex items-center gap-4 bg-white/10 p-2 rounded-full">
        <h3 className="text-lg font-semibold pl-2">Показать меню для:</h3>
        {settings.profiles.map((p) => (
          <label
            key={p.id}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={(settings.activeProfileIds || []).includes(
                p.id,
              )}
              onChange={() => onActiveProfilesChange(p.id)}
              className="form-checkbox h-5 w-5"
            />
            {p.name}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onShoppingListClick}
          className="bg-green-500/80 hover:bg-green-600/80"
        >
          <ShoppingCart size={20} /> Список покупок
        </Button>
        <div className="relative">
          <Button onClick={() => setIsExportOpen((prev) => !prev)}>
            <Download size={20} /> Экспорт меню
          </Button>
          {isExportOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-white/20 rounded-md shadow-lg z-20">
              <a
                onClick={() => {
                  onMenuExport("pdf");
                  setIsExportOpen(false);
                }}
                className="block px-4 py-2 text-sm text-white hover:bg-white/10 cursor-pointer"
              >
                Экспорт в PDF
              </a>
              <a
                onClick={() => {
                  onMenuExport("text");
                  setIsExportOpen(false);
                }}
                className="block px-4 py-2 text-sm text-white hover:bg:white/10 cursor-pointer"
              >
                Копировать текст
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
//                         КАРТОЧКА ДНЯ
// ----------------------------------------------------------------------

function DayCard({
  profile,
  dayKey,
  dishes,
  ingredients,
  dayMenu,
  onAddItem,
  onRemoveItem,
  onEditDishInstance,
}) {
  const target = useMemo(() => getTargetNutrition(profile), [profile]);

  const dailyTotals = useMemo(() => {
    return dayMenu.reduce(
      (totals, item) => {
        if (isDishItem(item)) {
          const dish = dishes.find((d) => d.id === item.dishId);
          const dishTotals = getMealTotalsForDish(
            dish,
            ingredients,
            item,
          );
          totals.kcal += dishTotals.kcal;
          totals.protein += dishTotals.protein;
          totals.fat += dishTotals.fat;
          totals.carbs += dishTotals.carbs;
          totals.price += dishTotals.price;
        } else if (isIngredientItem(item)) {
          const ing = ingredients.find(
            (i) => i.id === item.ingredientId,
          );
          const ingTotals = calculateIngredientNutrition(
            { quantity: item.quantity, unit: item.unit },
            ing,
            1,
          );
          totals.kcal += ingTotals.kcal;
          totals.protein += ingTotals.protein;
          totals.fat += ingTotals.fat;
          totals.carbs += ingTotals.carbs;
          totals.price += ingTotals.price;
        }
        return totals;
      },
      { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0 },
    );
  }, [dayMenu, dishes, ingredients]);

  return (
    <div className="bg-black/20 p-3 rounded-lg flex flex-col gap-3">
      <h4 className="font-bold text-center">{profile.name}</h4>
      <div className="text-xs text-center bg-black/20 p-1 rounded">
        <p className="font-semibold">
          Цель:{" "}
          <span className="text-yellow-300">
            {target.kcal.toFixed(0)}
          </span>{" "}
          / {target.protein.toFixed(0)} / {target.fat.toFixed(0)} /{" "}
          {target.carbs.toFixed(0)}
        </p>
      </div>

      <div className="space-y-2 min-h-[100px] flex-grow">
        {dayMenu.map((item) => {
          if (isDishItem(item)) {
            const dish = dishes.find((d) => d.id === item.dishId);
            if (!dish) return null;
            const dishTotals = getMealTotalsForDish(
              dish,
              ingredients,
              item,
            );
            const label = getDishLabel(item);

            return (
              <div
                key={item.id}
                className="text-xs bg-white/5 p-1.5 rounded-md"
              >
                <div className="flex justify-between items-center gap-1">
                  <span className="font-semibold">
                    {dish.name} ({label})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditDishInstance(item)}
                      className="text-blue-300 hover:text-blue-200"
                      title="Изменить ингредиенты для этого дня"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-pink-400 hover:text-pink-300"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-white/70">
                  КБЖУ: {dishTotals.kcal.toFixed(0)}/
                  {dishTotals.protein.toFixed(0)}/
                  {dishTotals.fat.toFixed(0)}/
                  {dishTotals.carbs.toFixed(0)}
                </p>
                {item.customIngredients && item.customIngredients.length > 0 && (
                  <p className="text-[10px] text-blue-200 mt-1">
                    Кастомный состав для этого дня
                  </p>
                )}
              </div>
            );
          }

          if (isIngredientItem(item)) {
            const ing = ingredients.find(
              (i) => i.id === item.ingredientId,
            );
            if (!ing) return null;
            const ingTotals = calculateIngredientNutrition(
              { quantity: item.quantity, unit: item.unit },
              ing,
              1,
            );
            const label = getIngredientLabel(item, ing);

            return (
              <div
                key={item.id}
                className="text-xs bg-white/5 p-1.5 rounded-md"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {ing.name} ({label})
                  </span>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="text-pink-400 hover:text-pink-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-white/70">
                  КБЖУ: {ingTotals.kcal.toFixed(0)}/
                  {ingTotals.protein.toFixed(0)}/
                  {ingTotals.fat.toFixed(0)}/
                  {ingTotals.carbs.toFixed(0)}
                </p>
              </div>
            );
          }

          return null;
        })}
      </div>

      <div className="text-xs text-center bg-black/20 p-1 rounded mt-auto">
        <p className="font-semibold">
          Итог:
          <span
            className={getNutrientClass(
              "kcal",
              dailyTotals.kcal,
              target.kcal,
              profile,
            )}
          >
            {" "}
            {dailyTotals.kcal.toFixed(0)}
          </span>{" "}
          /
          <span
            className={getNutrientClass(
              "protein",
              dailyTotals.protein,
              target.protein,
              profile,
            )}
          >
            {" "}
            {dailyTotals.protein.toFixed(0)}
          </span>{" "}
          /
          <span
            className={getNutrientClass(
              "fat",
              dailyTotals.fat,
              target.fat,
              profile,
            )}
          >
            {" "}
            {dailyTotals.fat.toFixed(0)}
          </span>{" "}
          /
          <span
            className={getNutrientClass(
              "carbs",
              dailyTotals.carbs,
              target.carbs,
              profile,
            )}
          >
            {" "}
            {dailyTotals.carbs.toFixed(0)}
          </span>
        </p>
        <p className="font-semibold">
          Цена: {dailyTotals.price.toFixed(2)} ₽
        </p>
      </div>

      <Button onClick={onAddItem} className="w-full text-sm !py-1.5">
        <PlusCircle size={16} /> Добавить
      </Button>
    </div>
  );
}

// ----------------------------------------------------------------------
//                   Модалка: добавить блюдо / ингредиент
// ----------------------------------------------------------------------

function AddMenuItemModal({
  dishes,
  ingredients,
  onAddDish,
  onAddIngredient,
  onClose,
}) {
  const [mode, setMode] = useState("dish"); // dish | ingredient
  const [selectedDish, setSelectedDish] = useState("");
  const [portionMode, setPortionMode] = useState("portion"); // portion | grams
  const [portion, setPortion] = useState(1);
  const [gramsForDish, setGramsForDish] = useState("");

  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState("grams");

  const currentIngredient = useMemo(
    () => ingredients.find((i) => i.id === selectedIngredient),
    [selectedIngredient, ingredients],
  );

  useEffect(() => {
    if (currentIngredient) {
      setIngredientUnit(currentIngredient.unit || "grams");
    }
  }, [currentIngredient]);

  const handleSubmit = () => {
    if (mode === "dish") {
      if (!selectedDish) return;

      if (portionMode === "grams") {
        const g = parseFloat(gramsForDish);
        if (!g || g <= 0) return;
        onAddDish(selectedDish, { grams: g });
      } else {
        const p = parseFloat(portion) || 1;
        onAddDish(selectedDish, { portion: p });
      }
    } else {
      if (!selectedIngredient) return;
      const q = parseFloat(ingredientQuantity);
      if (!q || q <= 0) return;
      onAddIngredient(selectedIngredient, q, ingredientUnit);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-2xl font-bold mb-4">Добавить в меню</h3>

      <div className="flex gap-4 text-sm mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="dish"
            checked={mode === "dish"}
            onChange={() => setMode("dish")}
          />
          Блюдо
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            value="ingredient"
            checked={mode === "ingredient"}
            onChange={() => setMode("ingredient")}
          />
          Ингредиент
        </label>
      </div>

      <div className="space-y-4">
        {mode === "dish" ? (
          <>
            <Select
              value={selectedDish}
              onChange={(e) => setSelectedDish(e.target.value)}
            >
              <option value="">Выберите блюдо...</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>

            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="portionMode"
                  value="portion"
                  checked={portionMode === "portion"}
                  onChange={() => setPortionMode("portion")}
                />
                По порциям
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="portionMode"
                  value="grams"
                  checked={portionMode === "grams"}
                  onChange={() => setPortionMode("grams")}
                />
                По граммам
              </label>
            </div>

            {portionMode === "portion" ? (
              <Input
                type="number"
                step="0.1"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                placeholder="Количество порций (например, 0.5, 1, 1.5)"
              />
            ) : (
              <Input
                type="number"
                step="1"
                value={gramsForDish}
                onChange={(e) => setGramsForDish(e.target.value)}
                placeholder="Вес готового блюда в граммах (например, 250)"
              />
            )}
          </>
        ) : (
          <>
            <Select
              value={selectedIngredient}
              onChange={(e) => setSelectedIngredient(e.target.value)}
            >
              <option value="">Выберите ингредиент...</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </Select>

            {currentIngredient && (
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ingredientUnit"
                    value="grams"
                    checked={ingredientUnit === "grams"}
                    onChange={(e) =>
                      setIngredientUnit(e.target.value)
                    }
                  />
                  Граммы
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="ingredientUnit"
                    value="pieces"
                    checked={ingredientUnit === "pieces"}
                    onChange={(e) =>
                      setIngredientUnit(e.target.value)
                    }
                  />
                  Штуки
                </label>
              </div>
            )}

            <Input
              type="number"
              step="0.1"
              value={ingredientQuantity}
              onChange={(e) => setIngredientQuantity(e.target.value)}
              placeholder="Количество (например, 50)"
            />
          </>
        )}

        <Button
          onClick={handleSubmit}
          className="w-full bg-blue-500/80 hover:bg-blue-600/80"
        >
          Добавить
        </Button>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------
//           Модалка: изменить пропорции ингредиентов блюда в дне
// ----------------------------------------------------------------------

function EditMenuDishModal({ dish, menuItem, ingredients, onSave, onClose }) {
  // базовый состав блюда
  const baseIngredients = (dish?.ingredients || []).map((i) => ({ ...i }));

  // то, что реально используется для этой записи в меню
  const initial =
    (menuItem.customIngredients && menuItem.customIngredients.length
      ? menuItem.customIngredients
      : baseIngredients) || [];

  const [localIngredients, setLocalIngredients] = useState(
    initial.map((i) => ({ ...i })),
  );

  const handleQtyChange = (index, value) => {
    setLocalIngredients((prev) =>
      prev.map((ing, i) =>
        i === index
          ? { ...ing, quantity: parseFloat(value) || 0 }
          : ing,
      ),
    );
  };

  const handleReset = () => {
    setLocalIngredients(baseIngredients.map((i) => ({ ...i })));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(localIngredients);
  };

  if (!dish) {
    return (
      <Modal onClose={onClose}>
        <p>Блюдо не найдено.</p>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-h-[80vh] overflow-y-auto pr-2"
      >
        <h3 className="text-2xl font-bold">
          {dish.name}: состав для этого дня
        </h3>
        <p className="text-sm text-white/70">
          Здесь ты можешь поменять граммовки ингредиентов
          <br />
          (рецепт блюда в общем списке не трогаем).
        </p>

        {localIngredients.length > 0 ? (
          <div className="space-y-2">
            {localIngredients.map((item, index) => {
              const ing = ingredients.find(
                (i) => i.id === item.ingredientId,
              );
              const unitLabel = item.unit === "pieces" ? "шт" : "г";

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-white/10 p-2 rounded-md text-sm"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {ing?.name || "?"} ({unitLabel})
                    </p>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleQtyChange(index, e.target.value)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-white/70">
            У этого блюда пока нет ингредиентов.
          </p>
        )}

        <div className="flex justify-between items-center pt-4">
          <Button
            type="button"
            onClick={handleReset}
            className="bg-white/10 hover:bg-white/20 text-sm"
          >
            Сбросить к рецепту блюда
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              className="bg-transparent border-none"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              className="bg-blue-500/80 hover:bg-blue-600/80"
            >
              Сохранить
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ----------------------------------------------------------------------
//                        Список покупок
// ----------------------------------------------------------------------



const handleExport = (format) => {
  const dateSuffix = getDateSuffix();

  if (format === "pdf") {
    // Открываем новую вкладку с HTML-страницей
    const win = window.open("", "_blank");
    if (!win) {
      showToast("Разреши всплывающие окна для этого сайта");
      return;
    }

    const title = `shoppinglist_${dateSuffix}`;

    const rowsHtml = shoppingList.list
      .map(
        (i) => `
          <tr>
            <td class="name">${i.name}</td>
            <td>${i.toBuyAmount} ${i.toBuyUnit}</td>
            <td>${i.totalGrams.toFixed(0)} г</td>
            <td>${i.cost.toFixed(2)} ₽</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
                   system-ui, sans-serif;
      background: #f5f5fa;
      color: #111827;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px;
    }
    .subtitle {
      margin-bottom: 16px;
      font-size: 13px;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      font-size: 13px;
    }
    thead {
      background: #e5f5ff;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    td.name {
      font-weight: 600;
    }
    .footer {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 600;
      text-align: right;
    }
    .print-hint {
      margin-top: 4px;
      font-size: 11px;
      color: #9ca3af;
      text-align: right;
    }
  </style>
</head>
<body>
  <h1>Список покупок</h1>
  <div class="subtitle">Сгенерировано: ${dateSuffix.replace(/_/g, ".")}</div>
  <table>
    <thead>
      <tr>
        <th>Название</th>
        <th>Купить</th>
        <th>Всего нужно</th>
        <th>Цена</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    Итоговая стоимость: ${shoppingList.totalCost.toFixed(2)} ₽
  </div>
  <div class="print-hint">
    Для сохранения в PDF: Файл → Печать → «Сохранить как PDF»
  </div>
  <script>
    // Мягко предлагаем распечатать / сохранить как PDF
    setTimeout(function () {
      try { window.print(); } catch (e) {}
    }, 400);
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } else if (format === "text") {
    // TXT-файл с русским текстом
    let textContent = "Список покупок\n\n";

    textContent += shoppingList.list
      .map(
        (i) =>
          `${i.name}: ${i.toBuyAmount} ${i.toBuyUnit} (нужно ${i.totalGrams.toFixed(
            0
          )} г) — ${i.cost.toFixed(2)} ₽`
      )
      .join("\n");

    textContent += `\n\nИтого: ${shoppingList.totalCost.toFixed(2)} ₽`;

    const blob = new Blob([textContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shoppinglist_${dateSuffix}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("TXT-файл списка покупок сохранён");
  }
};

// если уже есть getDateSuffix выше в файле — эту функцию НЕ дублируй


function ShoppingList({ weeklyMenu, dishes, ingredients, settings, onClose, showToast }) {
  const shoppingList = useMemo(() => {
    const requiredIngredients = {};
    const activeProfileIds = settings.activeProfileIds || [];

    activeProfileIds.forEach((profileId) => {
      const profileMenu = weeklyMenu[profileId] || {};
      Object.values(profileMenu)
        .flat()
        .forEach((meal) => {
          const dish = dishes.find((d) => d.id === meal.dishId);
          if (!dish || !dish.ingredients) return;

          dish.ingredients.forEach((item) => {
            const ing = ingredients.find((i) => i.id === item.ingredientId);
            if (!ing) return;

            const { weight } = calculateIngredientNutrition(item, ing, meal.portion);

            if (!requiredIngredients[ing.id]) {
              requiredIngredients[ing.id] = { ...ing, totalGrams: 0 };
            }
            requiredIngredients[ing.id].totalGrams += weight;
          });
        });
    });

    let totalCost = 0;

    const list = Object.values(requiredIngredients).map((ing) => {
      let toBuyAmount;
      let toBuyUnit;
      let remainder = 0;
      let cost = 0;

      if (ing.unit === "grams") {
        toBuyAmount = Math.ceil(ing.totalGrams / 10) * 10;
        toBuyUnit = "г";
        cost = (ing.price / 1000) * toBuyAmount;
      } else {
        if (!ing.gramsPerPiece || ing.gramsPerPiece === 0) {
          toBuyAmount = "?";
          toBuyUnit = "шт";
        } else {
          toBuyAmount = Math.ceil(ing.totalGrams / ing.gramsPerPiece);
          toBuyUnit = "шт";
          remainder = toBuyAmount * ing.gramsPerPiece - ing.totalGrams;
          cost = ing.price * toBuyAmount;
        }
      }

      totalCost += cost;

      return {
        ...ing,
        toBuyAmount,
        toBuyUnit,
        remainder: remainder.toFixed(0),
        cost,
      };
    });

    return { list, totalCost };
  }, [weeklyMenu, dishes, ingredients, settings.activeProfileIds]);

  const handleExport = (format) => {
    const dateSuffix = getDateSuffix();

    if (format === "pdf") {
      // Открываем новую вкладку с готовой HTML-страницей
      const win = window.open("", "_blank");
      if (!win) {
        showToast("Разреши всплывающие окна для этого сайта");
        return;
      }

      const title = `shoppinglist_${dateSuffix}`;

      const rowsHtml = shoppingList.list
        .map(
          (i) => `
          <tr>
            <td class="name">${i.name}</td>
            <td>${i.toBuyAmount} ${i.toBuyUnit}</td>
            <td>${i.totalGrams.toFixed(0)} г</td>
            <td>${i.cost.toFixed(2)} ₽</td>
          </tr>`
        )
        .join("");

      const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
                   system-ui, sans-serif;
      background: #f5f5fa;
      color: #111827;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px;
    }
    .subtitle {
      margin-bottom: 16px;
      font-size: 13px;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      font-size: 13px;
    }
    thead {
      background: #e5f5ff;
    }
    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    td.name {
      font-weight: 600;
    }
    .footer {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 600;
      text-align: right;
    }
    .print-hint {
      margin-top: 4px;
      font-size: 11px;
      color: #9ca3af;
      text-align: right;
    }
  </style>
</head>
<body>
  <h1>Список покупок</h1>
  <div class="subtitle">Сгенерировано: ${dateSuffix.replace(/_/g, ".")}</div>
  <table>
    <thead>
      <tr>
        <th>Название</th>
        <th>Купить</th>
        <th>Всего нужно</th>
        <th>Цена</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    Итоговая стоимость: ${shoppingList.totalCost.toFixed(2)} ₽
  </div>
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    } else if (format === "text") {
      let textContent = "Список покупок\n\n";

      textContent += shoppingList.list
        .map(
          (i) =>
            `${i.name}: ${i.toBuyAmount} ${i.toBuyUnit} (нужно ${i.totalGrams.toFixed(
              0
            )} г) — ${i.cost.toFixed(2)} ₽`
        )
        .join("\n");

      textContent += `\n\nИтого: ${shoppingList.totalCost.toFixed(2)} ₽`;

      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shoppinglist_${dateSuffix}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("TXT-файл списка покупок сохранён");
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold">Список покупок</h3>
        <div className="flex gap-2">
          <Button onClick={() => handleExport("pdf")} className="!p-2">
            <Download size={16} />
          </Button>
          <Button onClick={() => handleExport("text")} className="!p-2">
            <Copy size={16} />
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
        {shoppingList.list.length > 0 ? (
          shoppingList.list.map((ing) => (
            <div
              key={ing.id}
              className="bg-white/10 p-3 rounded-lg text-sm flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-base">{ing.name}</p>
                <p>
                  Купить:{" "}
                  <span className="font-bold text-green-300">
                    {ing.toBuyAmount} {ing.toBuyUnit}
                  </span>
                </p>
                {ing.unit === "pieces" && ing.remainder > 0 && (
                  <p className="text-xs text-white/70">
                    Останется: {ing.remainder} г
                  </p>
                )}
              </div>
              <p className="font-bold text-lg">{ing.cost.toFixed(2)} ₽</p>
            </div>
          ))
        ) : (
          <p className="text-white/80">
            Меню пустое, список не сформирован.
          </p>
        )}
      </div>

      <div className="mt-4 text-right font-bold text-xl">
        Итоговая стоимость: {shoppingList.totalCost.toFixed(2)} ₽
      </div>
    </Modal>
  );
}