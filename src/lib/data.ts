export const MODEL_VERSION = "astana-1.0";
export const BUDGET = 100;
export const HORIZON = 8;
export const DECISIONS = 5;
export const CATEGORIES = [
  { id: "transport", name: "Транспорт", short: "Транспорт", color: "#497599" },
  { id: "ecology", name: "Экология", short: "Экология", color: "#426f52" },
  { id: "social", name: "Социальная инфраструктура", short: "Соцсфера", color: "#86632e" },
  { id: "safety", name: "Безопасность", short: "Безопасность", color: "#7d6177" },
  { id: "services", name: "Городские сервисы", short: "Сервисы", color: "#4e7270" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const METRICS = [
  { id: "T1", name: "Разгрузка дорог", category: "transport", weight: 0.1 },
  { id: "T2", name: "Доступность транспорта", category: "transport", weight: 0.1 },
  { id: "E1", name: "Озеленение", category: "ecology", weight: 0.09 },
  { id: "E2", name: "Качество воздуха", category: "ecology", weight: 0.11 },
  { id: "S1", name: "Школы и детсады", category: "social", weight: 0.11 },
  { id: "S2", name: "Первичная медпомощь", category: "social", weight: 0.11 },
  { id: "B1", name: "Безопасность улиц", category: "safety", weight: 0.09 },
  { id: "B2", name: "Безопасность на дорогах", category: "safety", weight: 0.09 },
  { id: "C1", name: "Надёжность ЖКХ", category: "services", weight: 0.1 },
  { id: "C2", name: "Решение обращений", category: "services", weight: 0.1 },
] as const;
export type MetricId = (typeof METRICS)[number]["id"];
export type Indicators = Record<MetricId, number>;
export type DistrictId = "esil" | "almaty" | "saryarka" | "baikonur" | "nura";
export interface District {
  id: DistrictId;
  name: string;
  population: number;
  description: string;
  indicators: Indicators;
}
const indicators = (values: number[]): Indicators =>
  Object.fromEntries(METRICS.map((m, i) => [m.id, values[i]])) as Indicators;
export const DISTRICTS: District[] = [
  {
    id: "esil",
    name: "Есиль",
    population: 0.27,
    description: "Пробки и нагрузка на школы при высокой обеспеченности сервисами.",
    indicators: indicators([45, 62, 68, 72, 48, 55, 78, 60, 75, 70]),
  },
  {
    id: "almaty",
    name: "Алматы",
    population: 0.24,
    description: "Транспортная нагрузка и необходимость обновления коммунальных сетей.",
    indicators: indicators([40, 75, 50, 55, 60, 65, 62, 52, 50, 60]),
  },
  {
    id: "saryarka",
    name: "Сарыарка",
    population: 0.2,
    description: "Качество воздуха, зелёные зоны и надёжность ЖКХ требуют внимания.",
    indicators: indicators([50, 70, 42, 40, 62, 68, 58, 55, 45, 55]),
  },
  {
    id: "baikonur",
    name: "Байконур",
    population: 0.13,
    description:
      "Умеренные показатели во всех направлениях. Есть потенциал для адресных улучшений.",
    indicators: indicators([52, 68, 55, 50, 58, 60, 52, 58, 55, 58]),
  },
  {
    id: "nura",
    name: "Нура",
    population: 0.16,
    description: "Дефицит школ и первичной медпомощи. Самая низкая исходная оценка района.",
    indicators: indicators([55, 40, 45, 65, 38, 35, 55, 50, 60, 50]),
  },
];
export interface Measure {
  id: string;
  category: CategoryId;
  name: string;
  description: string;
  scope: "district" | "city";
  cost: number;
  lag: number;
  effects: Partial<Indicators>;
}
export const MEASURES: Measure[] = [
  {
    id: "M1",
    category: "transport",
    name: "Полосы для автобусов",
    description: "Выделенные полосы повышают доступность общественного транспорта.",
    scope: "district",
    cost: 18,
    lag: 2,
    effects: { T1: 6, T2: 9 },
  },
  {
    id: "M2",
    category: "transport",
    name: "Умные светофоры",
    description: "Адаптивное управление движением во всех районах города.",
    scope: "city",
    cost: 22,
    lag: 2,
    effects: { T1: 4, B2: 3 },
  },
  {
    id: "M3",
    category: "transport",
    name: "Линия ЛРТ",
    description: "Расширение рельсового транспорта с длительным сроком реализации.",
    scope: "district",
    cost: 30,
    lag: 4,
    effects: { T1: 16, T2: 20, E2: 4 },
  },
  {
    id: "M4",
    category: "ecology",
    name: "Парк или сквер",
    description: "Новые зелёные пространства, более чистый воздух и безопасные улицы.",
    scope: "district",
    cost: 15,
    lag: 2,
    effects: { E1: 12, E2: 3, B1: 2 },
  },
  {
    id: "M5",
    category: "ecology",
    name: "Чистое топливо",
    description: "Перевод частного сектора на чистое топливо и улучшение надёжности ЖКХ.",
    scope: "district",
    cost: 25,
    lag: 3,
    effects: { E2: 14, C1: 4 },
  },
  {
    id: "M6",
    category: "ecology",
    name: "Городское озеленение",
    description: "Озеленение и ветрозащитные полосы во всех пяти районах.",
    scope: "city",
    cost: 20,
    lag: 4,
    effects: { E1: 5, E2: 3 },
  },
  {
    id: "M7",
    category: "social",
    name: "Школа и детский сад",
    description: "Модульное строительство для сокращения дефицита учебных мест.",
    scope: "district",
    cost: 24,
    lag: 3,
    effects: { S1: 16 },
  },
  {
    id: "M8",
    category: "social",
    name: "Семейная поликлиника",
    description: "Центр семейного здоровья и доступная первичная медицинская помощь.",
    scope: "district",
    cost: 20,
    lag: 3,
    effects: { S2: 14 },
  },
  {
    id: "M9",
    category: "social",
    name: "Дворовые спорт-хабы",
    description: "Быстрые локальные улучшения социальной среды и безопасности.",
    scope: "district",
    cost: 10,
    lag: 1,
    effects: { S1: 3, S2: 3, B1: 3 },
  },
  {
    id: "M10",
    category: "safety",
    name: "Освещение и камеры",
    description: "Расширение Safe City: освещённые улицы и более безопасные дороги.",
    scope: "district",
    cost: 12,
    lag: 1,
    effects: { B1: 12, B2: 2 },
  },
  {
    id: "M11",
    category: "safety",
    name: "Безопасные переходы",
    description: "Переходы и школьные зоны повышают безопасность, но замедляют движение.",
    scope: "district",
    cost: 10,
    lag: 1,
    effects: { B2: 12, T1: -2 },
  },
  {
    id: "M12",
    category: "services",
    name: "Платформа обращений",
    description: "Единая цифровая платформа для своевременного решения обращений жителей.",
    scope: "city",
    cost: 14,
    lag: 1,
    effects: { C2: 5 },
  },
  {
    id: "M13",
    category: "services",
    name: "Обновление сетей ЖКХ",
    description: "Модернизация тепло- и водосетей с долгосрочным эффектом.",
    scope: "district",
    cost: 28,
    lag: 4,
    effects: { C1: 18, E2: 2 },
  },
  {
    id: "M14",
    category: "services",
    name: "Аварийные бригады",
    description: "Бригады ЖКХ и раннее оповещение об авариях по всему городу.",
    scope: "city",
    cost: 16,
    lag: 1,
    effects: { C1: 5, C2: 2 },
  },
];
export const MEASURE_BY_ID = Object.fromEntries(MEASURES.map((m) => [m.id, m])) as Record<
  string,
  Measure
>;
export interface Decision {
  measureId: string;
  districtId?: DistrictId;
}
export const EXAMPLE: Decision[] = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
];
export const CITY_EXAMPLE: Decision[] = [
  { measureId: "M2" },
  { measureId: "M6" },
  { measureId: "M9", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M14" },
];
