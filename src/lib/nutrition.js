// src/lib/nutrition.js

// --- КОЭФФИЦИЕНТЫ ГОТОВКИ ---

// Сколько грамм ГОТОВОГО продукта получается из 1 г сырого.
// Для мяса берём ~0.7 (30% ужарка/уварка/упекание).
const COOKING_METHOD_WEIGHT_RATIO = {
  raw: 1.0,
  fried: 0.7,
  boiled: 0.7,
  baked: 0.7,
};

const getWeightRatio = (method) =>
  COOKING_METHOD_WEIGHT_RATIO[method] ?? COOKING_METHOD_WEIGHT_RATIO.raw;

// Преобразуем КБЖУ "на 100 г сырого" -> "на 100 г готового"
const applyCookingMethodToMacros = (ingredient, cookingMethod) => {
  const method = cookingMethod || "raw";
  const ratio = getWeightRatio(method);

  const base = {
    kcal: ingredient.kcal || 0,
    protein: ingredient.protein || 0,
    fat: ingredient.fat || 0,
    carbs: ingredient.carbs || 0,
  };

  if (ratio <= 0) return base;

  return {
    kcal: base.kcal / ratio,
    protein: base.protein / ratio,
    fat: base.fat / ratio,
    carbs: base.carbs / ratio,
  };
};

// item: { quantity, unit: 'grams' | 'pieces', cookingMethod? }
// ingredient: запись из коллекции ингредиентов (КБЖУ на 100 г СЫРОГО)
// portionMultiplier: множитель порции (1 — базовая, 0.5 — полпорции)
// cookingMethod: можно передать явно, либо возьмётся из item.cookingMethod
export const calculateIngredientNutrition = (
  item,
  ingredient,
  portionMultiplier = 1,
  cookingMethod,
) => {
  if (!item || !ingredient) {
    return {
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      price: 0,
      weight: 0,
    };
  }

  const quantity = item.quantity * portionMultiplier;

  // Вес ГОТОВОГО продукта, который указали в интерфейсе
  let cookedWeightInGrams = 0;
  if (item.unit === "grams") {
    cookedWeightInGrams = quantity;
  } else {
    cookedWeightInGrams = quantity * (ingredient.gramsPerPiece || 0);
  }

  const method = cookingMethod || item.cookingMethod || "raw";
  const ratio = getWeightRatio(method) || 1;

  // Сколько сырого продукта ушло на этот готовый вес
  const rawWeightInGrams = cookedWeightInGrams / ratio;

  // КБЖУ на 100 г ГОТОВОГО
  const macrosPer100Cooked = applyCookingMethodToMacros(ingredient, method);
  const mCooked = cookedWeightInGrams / 100;

  // Цена считаем по СЫРОМУ весу (то, что покупаем)
  let price = 0;
  if (ingredient.unit === "grams") {
    price = (ingredient.price / 1000) * rawWeightInGrams;
  } else if (ingredient.gramsPerPiece > 0) {
    const piecesUsed = rawWeightInGrams / ingredient.gramsPerPiece;
    price = ingredient.price * piecesUsed;
  }

  return {
    kcal: macrosPer100Cooked.kcal * mCooked,
    protein: macrosPer100Cooked.protein * mCooked,
    fat: macrosPer100Cooked.fat * mCooked,
    carbs: macrosPer100Cooked.carbs * mCooked,
    price: price || 0,
    weight: cookedWeightInGrams, // показываем ГОТОВЫЙ вес
  };
};

export const calculateTotalsForDish = (
  dish,
  ingredients,
  portionMultiplier = 1,
) => {
  if (!dish || !dish.ingredients) {
    return {
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      price: 0,
      totalWeight: 0,
    };
  }

  return dish.ingredients.reduce(
    (totals, item) => {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      const n = calculateIngredientNutrition(
        item,
        ing,
        portionMultiplier,
        item.cookingMethod,
      );
      totals.kcal += n.kcal;
      totals.protein += n.protein;
      totals.fat += n.fat;
      totals.carbs += n.carbs;
      totals.price += n.price;
      totals.totalWeight += n.weight;
      return totals;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0, price: 0, totalWeight: 0 },
  );
};

// --- ЦЕЛИ КБЖУ ---

const calculateBMR = (profile) => {
  const w = parseFloat(profile.weight);
  const h = parseFloat(profile.height);
  const a = parseFloat(profile.age);
  if (!w || !h || !a) return 0;

  return profile.gender === "male"
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
};

// "чистая" формульная цель (учитывает nutritionMode, НЕ учитывает кастом)
export const getFormulaTarget = (profile) => {
  if (!profile) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  const bmr = calculateBMR(profile);
  const tdee = bmr * (profile.activity || 1.375);
  const mode = profile.nutritionMode || "maintenance";

  let kcal = tdee;
  let proteinFactor = 2;
  let fatFactor = 0.8;

  if (mode === "cutting") {
    kcal *= 0.8;
  }
  if (mode === "bulking") {
    kcal *= 1.2;
    proteinFactor = 2.5;
    fatFactor = 0.7;
  }

  const protein = (profile.weight || 0) * proteinFactor;
  const fat = (profile.weight || 0) * fatFactor;
  const carbs = (kcal - protein * 4 - fat * 9) / 4;

  return { kcal, protein, fat, carbs };
};

// Основная функция: если включены кастомные цели — используем их,
// иначе считаем по формуле.
export const getTargetNutrition = (profile) => {
  if (!profile) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };

  if (profile.useCustomTargets) {
    const kcal = parseFloat(profile.customKcal);
    const protein = parseFloat(profile.customProtein);
    const fat = parseFloat(profile.customFat);
    const carbs = parseFloat(profile.customCarbs);

    if (kcal > 0 && protein >= 0 && fat >= 0 && carbs >= 0) {
      return { kcal, protein, fat, carbs };
    }
  }

  return getFormulaTarget(profile);
};

export const getNutrientClass = (type, value, target, profile) => {
  if (!profile || target === 0) return "text-white";

  const deviation = (value - target) / target;
  const weight = profile.weight;
  const mode = profile.nutritionMode;

  switch (mode) {
    case "cutting":
      if (type === "kcal")
        return deviation >= -0.15 && deviation <= 0.05
          ? "text-green-300"
          : "text-red-400";
      if (type === "protein")
        return deviation >= -0.05 && deviation <= 0.4
          ? "text-green-300"
          : "text-red-400";
      if (type === "fat")
        return deviation >= -0.1 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
      if (type === "carbs")
        return value >= 75 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
      break;

    case "bulking":
      if (type === "kcal")
        return deviation >= -0.05 && deviation <= 0.15
          ? "text-green-300"
          : "text-red-400";
      if (type === "protein")
        return value >= 2.2 * weight && deviation <= 0.4
          ? "text-green-300"
          : "text-red-400";
      if (type === "fat")
        return deviation >= -0.1 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
      if (type === "carbs")
        return deviation >= -0.15 && deviation <= 0.15
          ? "text-green-300"
          : "text-red-400";
      break;

    default:
      if (type === "kcal")
        return deviation >= -0.2 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
      if (type === "protein")
        return value >= 1.8 * weight ? "text-green-300" : "text-red-400";
      if (type === "fat")
        return deviation >= -0.1 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
      if (type === "carbs")
        return deviation >= -0.1 && deviation <= 0.1
          ? "text-green-300"
          : "text-red-400";
  }

  return "text-white";
};