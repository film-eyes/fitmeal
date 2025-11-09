// src/features/dishes/DishesManager.jsx
import React, { useState, useMemo, useEffect } from "react";
import { PlusCircle, Edit, Trash2, ChevronDown } from "lucide-react";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";

import {
  calculateTotalsForDish,
  calculateIngredientNutrition,
} from "../../lib/nutrition";

// варианты способов готовки
const COOKING_METHOD_OPTIONS = [
  { value: "raw", label: "Без обработки (сырой продукт)" },
  { value: "fried", label: "Жарка (~30% ужарка)" },
  { value: "boiled", label: "Варка (~30% уварка)" },
  { value: "baked", label: "Запекание (~30% упекание)" },
];

// ----- ФОРМА ДОБАВЛЕНИЯ / РЕДАКТИРОВАНИЯ БЛЮДА -----

function DishForm({ dish, ingredients, onSave, onClose }) {
  const [formState, setFormState] = useState({
    name: dish?.name || "",
    cookingTime: dish?.cookingTime || "",
    recipe: dish?.recipe || "",
    // сюда могут приходить ингредиенты с cookingMethod из базы
    ingredients: dish?.ingredients || [],
  });

  const [newIngredient, setNewIngredient] = useState({
    id: "",
    quantity: "",
    unit: "grams",
    cookingMethod: "raw",
  });

  const selectedIngredient = useMemo(
    () => ingredients.find((i) => i.id === newIngredient.id),
    [newIngredient.id, ingredients],
  );

  useEffect(() => {
    if (selectedIngredient) {
      setNewIngredient((prev) => ({
        ...prev,
        unit: selectedIngredient.unit || "grams",
      }));
    }
  }, [selectedIngredient]);

  const handleChange = (e) =>
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleIngredientChange = (e) =>
    setNewIngredient((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const addIngredientToDish = () => {
    if (!newIngredient.id || !newIngredient.quantity) return;

    setFormState((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          ingredientId: newIngredient.id,
          quantity: parseFloat(newIngredient.quantity),
          unit: newIngredient.unit,
          cookingMethod: newIngredient.cookingMethod || "raw",
        },
      ],
    }));

    setNewIngredient({
      id: "",
      quantity: "",
      unit: "grams",
      cookingMethod: "raw",
    });
  };

  const removeIngredientFromDish = (index) =>
    setFormState((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formState);
  };

  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 max-h-[80vh] overflow-y-auto pr-2"
      >
        <h3 className="text-2xl font-bold">
          {dish ? "Редактировать" : "Добавить"} блюдо
        </h3>

        <Input
          name="name"
          value={formState.name}
          onChange={handleChange}
          placeholder="Название блюда"
          required
        />
        <Input
          name="cookingTime"
          value={formState.cookingTime}
          onChange={handleChange}
          placeholder="Время готовки"
          required
        />
        <textarea
          name="recipe"
          value={formState.recipe}
          onChange={handleChange}
          placeholder="Рецепт..."
          className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 h-24"
        />

        {/* список ингредиентов блюда */}
        <div className="space-y-2">
          <h4 className="font-semibold">Ингредиенты блюда:</h4>
          {formState.ingredients.length > 0 ? (
            <ul className="space-y-1">
              {formState.ingredients.map((item, index) => {
                const ing = ingredients.find(
                  (i) => i.id === item.ingredientId,
                );
                const method = item.cookingMethod || "raw";
                const methodLabel =
                  COOKING_METHOD_OPTIONS.find(
                    (opt) => opt.value === method,
                  )?.label || null;

                return (
                  <li
                    key={index}
                    className="flex justify-between items-center bg-white/10 p-2 rounded-md"
                  >
                    <span>
                      {ing?.name || "?"}: {item.quantity}{" "}
                      {item.unit === "grams" ? "г" : "шт"}
                      {method !== "raw" && methodLabel && (
                        <span className="ml-1 text-xs text-white/70">
                          ({methodLabel})
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeIngredientFromDish(index)}
                      className="text-pink-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-white/70">Добавьте ингредиенты.</p>
          )}
        </div>

        {/* блок "Добавить ингредиент" */}
        <div className="space-y-2 p-3 bg-white/10 rounded-lg">
          <h4 className="font-semibold">Добавить ингредиент:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select
              name="id"
              value={newIngredient.id}
              onChange={handleIngredientChange}
            >
              <option value="">Выберите...</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </Select>
            <Input
              name="quantity"
              type="number"
              step="0.1"
              value={newIngredient.quantity}
              onChange={handleIngredientChange}
              placeholder="Кол-во"
            />
          </div>

          {/* способ готовки */}
          <Select
            name="cookingMethod"
            value={newIngredient.cookingMethod}
            onChange={handleIngredientChange}
          >
            {COOKING_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* единицы измерения для ингредиентов в "pieces" */}
          {selectedIngredient?.unit === "pieces" && (
            <div className="flex gap-4 items-center text-sm">
              <label>Единицы:</label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="unit"
                  value="pieces"
                  checked={newIngredient.unit === "pieces"}
                  onChange={handleIngredientChange}
                />
                Штуки
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="unit"
                  value="grams"
                  checked={newIngredient.unit === "grams"}
                  onChange={handleIngredientChange}
                />
                Граммы
              </label>
            </div>
          )}

          <Button onClick={addIngredientToDish} className="w-full">
            <PlusCircle size={16} /> Добавить в блюдо
          </Button>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button
            onClick={onClose}
            type="button"
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
      </form>
    </Modal>
  );
}

// ----- ОСНОВНОЙ МЕНЕДЖЕР БЛЮД -----

export default function DishesManager({
  dishes,
  ingredients,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name-asc");

  const openAddModal = () => {
    setEditingDish(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dish) => {
    setEditingDish(dish);
    setIsModalOpen(true);
  };

  const handleSave = (dish) => {
    if (editingDish) {
      onUpdate(editingDish.id, dish);
    } else {
      onAdd(dish);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Вы уверены?")) onDelete(id);
  };

  // блюда + totals + per100 для сортировки и отображения
  const processedDishes = useMemo(() => {
    const term = search.trim().toLowerCase();

    let list = dishes.map((dish) => {
      const totals = calculateTotalsForDish(dish, ingredients, 1);

      const per100 =
        totals.totalWeight > 0
          ? {
              kcal: (totals.kcal / totals.totalWeight) * 100,
              protein: (totals.protein / totals.totalWeight) * 100,
              fat: (totals.fat / totals.totalWeight) * 100,
              carbs: (totals.carbs / totals.totalWeight) * 100,
              price: (totals.price / totals.totalWeight) * 100,
            }
          : { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0 };

      return { dish, totals, per100 };
    });

    if (term) {
      list = list.filter(({ dish }) =>
        dish.name?.toLowerCase().includes(term),
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case "kcal-desc":
          return b.totals.kcal - a.totals.kcal;
        case "protein-desc":
          return b.totals.protein - a.totals.protein;
        case "protein100-desc":
          return b.per100.protein - a.per100.protein;
        case "price-asc":
          return a.totals.price - b.totals.price;
        case "name-desc":
          return (b.dish.name || "").localeCompare(a.dish.name || "");
        case "name-asc":
        default:
          return (a.dish.name || "").localeCompare(b.dish.name || "");
      }
    });

    return list;
  }, [dishes, ingredients, search, sort]);

  return (
    <div>
      {/* Хедер: заголовок + поиск/сортировка/кнопка в одну строку */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h2 className="text-3xl font-bold">Блюда</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="sm:w-60"
          />
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="sm:w-56"
          >
            <option value="name-asc">По названию (А–Я)</option>
            <option value="name-desc">По названию (Я–А)</option>
            <option value="kcal-desc">По калориям (убывание)</option>
            <option value="protein-desc">По белку (убывание)</option>
            <option value="protein100-desc">
              По белку на 100г (убывание)
            </option>
            <option value="price-asc">По цене (возрастание)</option>
          </Select>
          <Button onClick={openAddModal}>
            <PlusCircle size={20} /> Добавить
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <DishForm
          dish={editingDish}
          ingredients={ingredients}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {processedDishes.length > 0 ? (
          processedDishes.map(({ dish, totals, per100 }) => {
            const per100g = per100;

            return (
              <Card key={dish.id}>
                <h3 className="text-xl font-bold mb-2">{dish.name}</h3>
                <p className="text-sm text-white/80 mb-2">
                  Время готовки: {dish.cookingTime}
                </p>

                <div className="grid grid-cols-2 gap-2 text-sm space-y-1 bg-white/10 p-2 rounded-md mb-2">
                  <div>
                    <p className="font-semibold">
                      На порцию ({totals.totalWeight.toFixed(0)}г):
                    </p>
                    <p>
                      К: {totals.kcal.toFixed(0)}, Б:{" "}
                      {totals.protein.toFixed(1)}, Ж:{" "}
                      {totals.fat.toFixed(1)}, У:{" "}
                      {totals.carbs.toFixed(1)}
                    </p>
                    <p>Цена: {totals.price.toFixed(2)} ₽</p>
                  </div>
                  <div>
                    <p className="font-semibold">На 100г:</p>
                    <p>
                      К: {per100g.kcal.toFixed(0)}, Б:{" "}
                      {per100g.protein.toFixed(1)}, Ж:{" "}
                      {per100g.fat.toFixed(1)}, У:{" "}
                      {per100g.carbs.toFixed(1)}
                    </p>
                    <p>Цена: {per100g.price.toFixed(2)} ₽</p>
                  </div>
                </div>

                <details className="text-sm cursor-pointer">
                  <summary className="font-semibold flex items-center gap-1">
                    Ингредиенты <ChevronDown size={16} />
                  </summary>
                  <ul className="mt-1 pl-2 text-white/90 space-y-2">
                    {(dish.ingredients || []).map((item, index) => {
                      const ing = ingredients.find(
                        (i) => i.id === item.ingredientId,
                      );
                      const ingTotals = calculateIngredientNutrition(
                        item,
                        ing,
                        1,
                      );
                      const method = item.cookingMethod || "raw";
                      const methodLabel =
                        COOKING_METHOD_OPTIONS.find(
                          (opt) => opt.value === method,
                        )?.label || null;

                      return (
                        <li
                          key={index}
                          className="text-xs p-1 bg-black/20 rounded"
                        >
                          <p className="font-bold">
                            {ing?.name || "?"}: {item.quantity}{" "}
                            {item.unit === "grams" ? "г" : "шт"}
                            {method !== "raw" && methodLabel && (
                              <span className="ml-1 text-[10px] text-white/70">
                                ({methodLabel})
                              </span>
                            )}
                          </p>
                          <p>
                            КБЖУ: {ingTotals.kcal.toFixed(0)}/
                            {ingTotals.protein.toFixed(1)}/
                            {ingTotals.fat.toFixed(1)}/
                            {ingTotals.carbs.toFixed(1)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </details>

                <details className="text-sm cursor-pointer mt-2">
                  <summary className="font-semibold flex items-center gap-1">
                    Рецепт <ChevronDown size={16} />
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-white/90 bg-black/20 p-2 rounded">
                    {dish.recipe || "Нет рецепта"}
                  </p>
                </details>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => openEditModal(dish)}
                    className="w-full"
                  >
                    <Edit size={16} /> Редакт.
                  </Button>
                  <Button
                    onClick={() => handleDelete(dish.id)}
                    className="w-full bg-pink-500/50 hover:bg-pink-600/50"
                  >
                    <Trash2 size={16} /> Удалить
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <p className="col-span-full text-center text-white/80">
            Список блюд пуст.
          </p>
        )}
      </div>
    </div>
  );
}