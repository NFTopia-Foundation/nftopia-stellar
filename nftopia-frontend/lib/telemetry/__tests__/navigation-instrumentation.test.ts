import {
  CTA_IDS,
  NAV_ITEM_IDS,
  CTA_PLACEMENTS,
  NAV_PLACEMENTS,
  normalizeRoute,
  emitCtaClicked,
  emitNavItemClicked,
  isValidCtaId,
  isValidNavItemId,
  isValidCtaPlacement,
  isValidNavPlacement,
} from "../navigation-instrumentation";

describe("navigation-instrumentation", () => {
  it("normalizes routes correctly", () => {
    expect(normalizeRoute("/marketplace?foo=bar#section")).toBe("/marketplace");
    expect(normalizeRoute("/collections/")).toBe("/collections");
    expect(normalizeRoute("https://site.com/landing?x=1")).toBe("/landing");
    expect(normalizeRoute("")).toBe("none");
  });

  it("validates CTA and nav IDs and placements", () => {
    expect(isValidCtaId(CTA_IDS.CONNECT_WALLET_HEADER)).toBe(true);
    expect(isValidNavItemId(NAV_ITEM_IDS.EXPLORE)).toBe(true);
    expect(isValidCtaPlacement(CTA_PLACEMENTS.LANDING_HERO_PRIMARY)).toBe(true);
    expect(isValidNavPlacement(NAV_PLACEMENTS.NAVBAR_DESKTOP)).toBe(true);
    expect(isValidCtaId("not_a_real_id")).toBe(false);
    expect(isValidNavPlacement("fake_placement")).toBe(false);
  });

  it("emits cta_clicked and nav_item_clicked events", () => {
    const track = jest.spyOn(require("../index").telemetry, "track").mockImplementation(() => {});
    emitCtaClicked({
      cta_id: CTA_IDS.CONNECT_WALLET_HEADER,
      placement: CTA_PLACEMENTS.NAVBAR_DESKTOP_RIGHT,
      destination_route: "/connect",
      interaction_type: "button",
      ui_variant: "primary",
    });
    emitNavItemClicked({
      nav_item_id: NAV_ITEM_IDS.EXPLORE,
      placement: NAV_PLACEMENTS.NAVBAR_DESKTOP,
      destination_route: "/explore",
      menu_state: "expanded",
    });
    expect(track).toHaveBeenCalledWith("cta_clicked", expect.objectContaining({ cta_id: CTA_IDS.CONNECT_WALLET_HEADER }));
    expect(track).toHaveBeenCalledWith("nav_item_clicked", expect.objectContaining({ nav_item_id: NAV_ITEM_IDS.EXPLORE }));
    track.mockRestore();
  });
});
