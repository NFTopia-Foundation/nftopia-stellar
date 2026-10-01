import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReportButton } from "@/src/components/ReportButton";
import { submitReport } from "@/src/lib/api";

jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "en",
  }),
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

jest.mock("@/src/lib/api", () => ({
  submitReport: jest.fn(),
}));

const mockSubmitReport = submitReport as jest.MockedFunction<typeof submitReport>;

function selectReasonAndSubmit(reasonLabel: RegExp) {
  fireEvent.click(screen.getByRole("radio", { name: reasonLabel }));
  fireEvent.click(screen.getByRole("button", { name: "report.submit" }));
}

describe("ReportButton submission flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockSubmitReport.mockResolvedValue(undefined);
  });

  it("opens the report modal with the reason picker", () => {
    render(<ReportButton targetType="nft" targetId="nft-123" />);

    fireEvent.click(screen.getByRole("button", { name: "report.action" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(
      screen.getByRole("radio", { name: /report.reasons.spam.label/ })
    ).toBeInTheDocument();
  });

  it("keeps submit disabled until a reason is selected", () => {
    render(<ReportButton targetType="nft" targetId="nft-123" />);
    fireEvent.click(screen.getByRole("button", { name: "report.action" }));

    expect(screen.getByRole("button", { name: "report.submit" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /report.reasons.scam.label/ }));

    expect(screen.getByRole("button", { name: "report.submit" })).toBeEnabled();
  });

  it("submits the selected reason, confirms success, and disables further reports", async () => {
    render(<ReportButton targetType="nft" targetId="nft-123" />);
    fireEvent.click(screen.getByRole("button", { name: "report.action" }));

    fireEvent.click(screen.getByRole("radio", { name: /report.reasons.spam.label/ }));
    fireEvent.change(screen.getByLabelText("report.detailsLabel"), {
      target: { value: "Stolen artwork" },
    });
    fireEvent.click(screen.getByRole("button", { name: "report.submit" }));

    await waitFor(() =>
      expect(mockSubmitReport).toHaveBeenCalledWith({
        targetType: "nft",
        targetId: "nft-123",
        reason: "spam",
        details: "Stolen artwork",
      })
    );

    expect(mockShowSuccess).toHaveBeenCalledWith("report.success");
    expect(mockShowError).not.toHaveBeenCalled();

    expect(await screen.findByText("report.successTitle")).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", { name: "report.close" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const reportButton = screen.getByRole("button", { name: "report.alreadyReported" });
    expect(reportButton).toBeDisabled();
    expect(sessionStorage.getItem("report:nft:nft-123")).toBe("1");
  });

  it("shows an error toast and allows retrying when submission fails", async () => {
    mockSubmitRejectedOnce();
    render(<ReportButton targetType="collection" targetId="col-1" />);
    fireEvent.click(screen.getByRole("button", { name: "report.action" }));

    selectReasonAndSubmit(/report.reasons.offensive.label/);

    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith("report.error"));
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockSubmitReport.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "report.submit" }));

    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith("report.success"));
    expect(mockSubmitReport).toHaveBeenCalledTimes(2);
  });

  it("hides the action behind a disabled state when already reported this session", () => {
    sessionStorage.setItem("report:profile:creator-9", "1");

    render(<ReportButton targetType="profile" targetId="creator-9" />);

    const reportButton = screen.getByRole("button", { name: "report.alreadyReported" });
    expect(reportButton).toBeDisabled();

    fireEvent.click(reportButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockSubmitReport).not.toHaveBeenCalled();
  });
});

function mockSubmitRejectedOnce() {
  mockSubmitReport.mockRejectedValueOnce(new Error("boom"));
}
