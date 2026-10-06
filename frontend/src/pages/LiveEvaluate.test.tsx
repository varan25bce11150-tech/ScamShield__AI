import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi, beforeEach } from "vitest";
import LiveEvaluate from "./LiveEvaluate";
import * as apiModule from "../api";
import type { EvaluateResponse } from "../api";

const mockEvaluate = vi.fn();
const originalEvaluate = apiModule.api.evaluate;

const renderPage = () =>
  render(
    <BrowserRouter>
      <LiveEvaluate />
    </BrowserRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  apiModule.api.evaluate = mockEvaluate;
});

afterEach(() => {
  apiModule.api.evaluate = originalEvaluate;
});

function getInput(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

test("amount input stays empty when cleared", () => {
  renderPage();
  const input = getInput("Amount");
  fireEvent.change(input, { target: { value: "250" } });
  expect(input.value).toBe("250");
  fireEvent.change(input, { target: { value: "" } });
  expect(input.value).toBe("");
});

test("submitting empty amount shows error", async () => {
  renderPage();
  const submit = screen.getByRole("button", { name: /evaluate risk/i });
  fireEvent.click(submit);
  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent(/enter an amount/i);
  });
  expect(mockEvaluate).not.toHaveBeenCalled();
});

test("submitting valid amount calls API with number", async () => {
  const mockResponse: EvaluateResponse = {
    transaction_id: "txn-1",
    timestamp: new Date().toISOString(),
    amount: 250,
    vpa: "alex@okaxis",
    decision: "ALLOW",
    risk_score: 10,
    advisory: "No strong scam signals.",
    intent_label: "neutral",
    intent_matches: [],
    factors: [],
  };
  mockEvaluate.mockResolvedValue(mockResponse);

  renderPage();
  const amount = getInput("Amount");
  const vpa = getInput("Recipient VPA");
  fireEvent.change(amount, { target: { value: "250" } });
  fireEvent.change(vpa, { target: { value: "alex@okaxis" } });
  fireEvent.click(screen.getByRole("button", { name: /evaluate risk/i }));

  await waitFor(() => {
    expect(screen.getByText(/ALLOW/i)).toBeInTheDocument();
  });

  expect(mockEvaluate).toHaveBeenCalledWith(
    expect.objectContaining({ amount: 250, vpa: "alex@okaxis" }),
  );
});

test("preset buttons populate form", () => {
  renderPage();
  const critical = screen.getByRole("button", { name: /critical scam/i });
  fireEvent.click(critical);
  expect(getInput("Amount")).toHaveValue("1");
  expect(getInput("Recipient VPA")).toHaveValue("pay-kyc-verify@fastpkr");
  expect(getInput("Payment note (optional)")).toHaveValue("Send 1 to verify your KYC");
  expect(screen.getByLabelText("Active call during payment")).toBeChecked();
  expect(screen.getByLabelText("First-time payee")).toBeChecked();
});

test("copy transaction ID button works", async () => {
  const mockResponse: EvaluateResponse = {
    transaction_id: "txn-copy-123",
    timestamp: new Date().toISOString(),
    amount: 100,
    vpa: "test@bank",
    decision: "ALLOW",
    risk_score: 5,
    advisory: "OK",
    intent_label: "neutral",
    intent_matches: [],
    factors: [],
  };
  mockEvaluate.mockResolvedValue(mockResponse);

  renderPage();
  const amount = getInput("Amount");
  const vpa = getInput("Recipient VPA");
  fireEvent.change(amount, { target: { value: "100" } });
  fireEvent.change(vpa, { target: { value: "test@bank" } });
  fireEvent.click(screen.getByRole("button", { name: /evaluate risk/i }));

  await waitFor(() => {
    expect(screen.getByText(/ALLOW/i)).toBeInTheDocument();
  });

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  fireEvent.click(screen.getByRole("button", { name: /copy/i }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /copied ✓/i })).toBeInTheDocument();
  });
});