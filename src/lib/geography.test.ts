import { expect, it } from "vitest";
import geography from "@/data/astana-districts.json";
import { DISTRICTS } from "./data";

it("maps exactly the five dataset districts to nonempty geometry inside Astana", () => {
  expect(geography.features.map((f) => f.properties.id).sort()).toEqual(
    DISTRICTS.map((d) => d.id).sort(),
  );
  for (const feature of geography.features) {
    expect(["Polygon", "MultiPolygon"]).toContain(feature.geometry.type);
    const coordinates = feature.geometry.coordinates.flat(Infinity) as number[];
    expect(coordinates.length).toBeGreaterThan(40);
    for (let index = 0; index < coordinates.length; index += 2) {
      expect(coordinates[index]).toBeGreaterThan(70.9);
      expect(coordinates[index]).toBeLessThan(72);
      expect(coordinates[index + 1]).toBeGreaterThan(50.8);
      expect(coordinates[index + 1]).toBeLessThan(51.6);
    }
  }
});

it("keeps the Saraishyk mapping and OSM provenance explicit", () => {
  expect(
    geography.features.find((f) => f.properties.id === "almaty")?.properties.osmRelations,
  ).toEqual([3482819, 19733918]);
  expect(geography.metadata.license).toBe("ODbL-1.0");
});
