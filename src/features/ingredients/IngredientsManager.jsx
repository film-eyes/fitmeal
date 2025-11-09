// src/features/ingredients/IngredientsManager.jsx
import React, { useState, useMemo } from "react";
import { PlusCircle, Edit, Trash2 } from "lucide-react";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";

function IngredientForm({ ingredient, onSave, onClose }) {
  const [formState, setFormState] = useState({
    name: ingredient?.name || "",
    unit: ingredient?.unit || "grams",
    price: ingredient?.price || "",
    gramsPerPiece: ingredient?.gramsPerPiece || "",
    kcal: ingredient?.kcal || "",
    protein: ingredient?.protein || "",
    fat: ingredient?.fat || "",
    carbs: ingredient?.carbs || "",
  });

  const handleChange = (e) =>
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = {
      name: formState.name,
      unit: formState.unit,
      price: parseFloat(formState.price) || 0,
      kcal: parseFloat(formState.kcal) || 0,
      protein: parseFloat(formState.protein) || 0,
      fat: parseFloat(formState.fat) || 0,
      carbs: parseFloat(formState.carbs) || 0,
    };
    if (formState.unit === "pieces") {
      dataToSave.gramsPerPiece = parseFloat(formState.gramsPerPiece) || 0;
    }
    onSave(dataToSave);
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-2xl font-bold">
          {ingredient ? "Редактировать" : "Добавить"} ингредиент
        </h3>

        <Input
          name="name"
          value={formState.name}
          onChange={handleChange}
          placeholder="Название"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            name="kcal"
            type="number"
            step="0.1"
            value={formState.kcal}
            onChange={handleChange}
            placeholder="Калории (на 100г)"
            required
          />
          <Input
            name="protein"
            type="number"
            step="0.1"
            value={formState.protein}
            onChange={handleChange}
            placeholder="Белки (на 100г)"
            required
          />
          <Input
            name="fat"
            type="number"
            step="0.1"
            value={formState.fat}
            onChange={handleChange}
            placeholder="Жиры (на 100г)"
            required
          />
          <Input
            name="carbs"
            type="number"
            step="0.1"
            value={formState.carbs}
            onChange={handleChange}
            placeholder="Углеводы (на 100г)"
            required
          />
        </div>

        <div className="flex gap-4 items-center">
          <label>Единицы:</label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="unit"
              value="grams"
              checked={formState.unit === "grams"}
              onChange={handleChange}
            />
            Граммы
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="unit"
              value="pieces"
              checked={formState.unit === "pieces"}
              onChange={handleChange}
            />
            Штуки
          </label>
        </div>

        {formState.unit === "pieces" && (
          <Input
            name="gramsPerPiece"
            type="number"
            step="0.1"
            value={formState.gramsPerPiece}
            onChange={handleChange}
            placeholder="Вес одной штуки в граммах"
            required
          />
        )}

        <Input
          name="price"
          type="number"
          step="0.01"
          value={formState.price}
          onChange={handleChange}
          placeholder={`Цена (руб. за ${
            formState.unit === "grams" ? "1000г" : "1 шт"
          })`}
          required
        />

        <div className="flex justify-end gap-4">
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

export default function IngredientsManager({
  ingredients,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name-asc");

  const openAddModal = () => {
    setEditingIngredient(null);
    setIsModalOpen(true);
  };

  const openEditModal = (ing) => {
    setEditingIngredient(ing);
    setIsModalOpen(true);
  };

  const handleSave = (ing) => {
    if (editingIngredient) {
      onUpdate(editingIngredient.id, ing);
    } else {
      onAdd(ing);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Вы уверены?")) onDelete(id);
  };

  const processedIngredients = useMemo(() => {
    const term = search.trim().toLowerCase();

    let list = [...ingredients];

    if (term) {
      list = list.filter((ing) =>
        ing.name?.toLowerCase().includes(term),
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case "kcal-desc":
          return (b.kcal || 0) - (a.kcal || 0);
        case "protein-desc":
          return (b.protein || 0) - (a.protein || 0);
        case "price-asc": {
          const pa = a.price || 0;
          const pb = b.price || 0;
          return pa - pb;
        }
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "name-asc":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

    return list;
  }, [ingredients, search, sort]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
  <h2 className="text-3xl font-bold">Ингредиенты</h2>
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
      <option value="price-asc">По цене (возрастание)</option>
    </Select>
    <Button onClick={openAddModal}>
      <PlusCircle size={20} /> Добавить
    </Button>
  </div>
</div>

      {isModalOpen && (
        <IngredientForm
          ingredient={editingIngredient}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {processedIngredients.length > 0 ? (
          processedIngredients.map((ing) => (
            <Card key={ing.id}>
              <h3 className="text-xl font-bold mb-2">{ing.name}</h3>
              <div className="text-sm space-y-1 text-white/90">
                <p>
                  КБЖУ на 100г: {ing.kcal} / {ing.protein} / {ing.fat} /{" "}
                  {ing.carbs}
                </p>
                <p>
                  Цена: {ing.price} руб. за{" "}
                  {ing.unit === "grams" ? "1000г" : "1 шт"}
                </p>
                { ing.unit === "pieces" && (
                  <p>Вес 1 шт: {ing.gramsPerPiece} г</p>
                ) }
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => openEditModal(ing)}
                  className="w-full"
                >
                  <Edit size={16} /> Редакт.
                </Button>
                <Button
                  onClick={() => handleDelete(ing.id)}
                  className="w-full bg-pink-500/50 hover:bg-pink-600/50"
                >
                  <Trash2 size={16} /> Удалить
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-white/80">
            Список ингредиентов пуст.
          </p>
        )}
      </div>
    </div>
  );
}