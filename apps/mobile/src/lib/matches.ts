import { localizedName, type CatalogProduct, type FoodMatch, type GenericFood } from '@repo/core';

export function matchFromFood(food: GenericFood, locale: string): FoodMatch {
  return {
    kind: 'generic_food',
    id: food.id,
    name: locale === 'en' ? food.nameEn : food.nameEs,
    basis: food.basis,
    nutrientsPer100: food.nutrientsPer100,
    source: food.source,
    sourceId: food.sourceId,
    score: 1,
    portions: food.portions,
    servingQuantity: null,
  };
}

export function matchFromProduct(product: CatalogProduct, locale: string): FoodMatch {
  const name = localizedName(product, locale) ?? product.gtin;
  return {
    kind: 'product',
    id: product.id,
    name: product.brand ? `${name} · ${product.brand}` : name,
    basis: product.basis,
    nutrientsPer100: product.nutrientsPer100,
    source: product.source,
    sourceId: product.gtin,
    score: 1,
    portions: [],
    servingQuantity: product.servingQuantity,
  };
}
