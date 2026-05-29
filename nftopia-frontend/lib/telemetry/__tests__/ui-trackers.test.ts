import { trackUIElementViewed, trackUIElementInteracted } from "../ui/element-tracker";
import { trackFormFieldInteraction, trackFormSubmissionAttempt, trackFormSubmissionSuccess } from "../ui/form-tracker";
import { trackScrollDepth } from "../ui/scroll-tracker";
import { trackLayoutVariantRendered, trackAccessibilityInteraction } from "../ui/performance-tracker";
import { DeviceType, ViewportPosition, LayoutVariant } from "../ui/types";

describe("UI Telemetry Trackers", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_UI_TELEMETRY_ENABLED = "true";
  });
  beforeEach(() => {
    jest.spyOn(require("../index").telemetry, "track").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("tracks UI element viewed", () => {
    trackUIElementViewed({
      element: "hero",
      visibilityPercent: 80,
      position: ViewportPosition.AboveFold,
      deviceType: DeviceType.Desktop,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "ui_element_viewed",
      expect.objectContaining({ element: "hero", visibilityPercent: 80 })
    );
  });

  it("tracks UI element interacted", () => {
    trackUIElementInteracted({
      element: "cta_button",
      interactionType: "click",
      timeToInteractionMs: 1200,
      deviceType: DeviceType.Mobile,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "ui_element_interacted",
      expect.objectContaining({ element: "cta_button", interactionType: "click" })
    );
  });

  it("tracks form field interaction", () => {
    trackFormFieldInteraction({
      form: "signup",
      field: "email",
      keystrokeCount: 10,
      validationErrors: 1,
      timeInFieldMs: 5000,
      deviceType: DeviceType.Tablet,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "form_field_interaction",
      expect.objectContaining({ form: "signup", field: "email" })
    );
  });

  it("tracks form submission attempt", () => {
    trackFormSubmissionAttempt({
      form: "signup",
      fieldCount: 3,
      validationErrors: 0,
      deviceType: DeviceType.Desktop,
      submissionId: "sub_1",
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "form_submission_attempt",
      expect.objectContaining({ form: "signup", fieldCount: 3 })
    );
  });

  it("tracks form submission success", () => {
    trackFormSubmissionSuccess({
      form: "signup",
      submissionId: "sub_1",
      latencyMs: 2000,
      attemptCount: 1,
      deviceType: DeviceType.Desktop,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "form_submission_success",
      expect.objectContaining({ form: "signup", submissionId: "sub_1" })
    );
  });

  it("tracks scroll depth milestone", () => {
    trackScrollDepth({
      milestone: 50,
      elementsPassed: ["hero", "features"],
      deviceType: DeviceType.Mobile,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "scroll_depth_tracked",
      expect.objectContaining({ milestone: 50, elementsPassed: ["hero", "features"] })
    );
  });

  it("tracks layout variant rendered", () => {
    trackLayoutVariantRendered({
      variant: LayoutVariant.Desktop,
      breakpoint: 1024,
      renderTimeMs: 300,
      deviceType: DeviceType.Desktop,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "layout_variant_rendered",
      expect.objectContaining({ variant: LayoutVariant.Desktop, breakpoint: 1024 })
    );
  });

  it("tracks accessibility interaction", () => {
    trackAccessibilityInteraction({
      interaction: "keyboard_nav",
      direction: "forward",
      elementBefore: "input1",
      elementAfter: "input2",
      deviceType: DeviceType.Desktop,
      timestamp: Date.now(),
    });
    expect(require("../index").telemetry.track).toHaveBeenCalledWith(
      "accessibility_interaction",
      expect.objectContaining({ interaction: "keyboard_nav", direction: "forward" })
    );
  });
});
