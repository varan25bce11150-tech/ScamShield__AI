import { parseUpiLink, isUpiLink } from "./upi";

describe("UPI link parsing", () => {
  test("valid full link", () => {
    const res = parseUpiLink("upi://pay?pa=alex@okaxis&pn=Alex%20Kumar&am=250&cu=INR&tn=Dinner%20split&tr=REF123");
    expect(res.vpa).toBe("alex@okaxis");
    expect(res.payeeName).toBe("Alex Kumar");
    expect(res.amount).toBe(250);
    expect(res.currency).toBe("INR");
    expect(res.note).toBe("Dinner split");
    expect(res.reference).toBe("REF123");
  });

  test("missing amount returns null amount", () => {
    const res = parseUpiLink("upi://pay?pa=alex@okaxis&pn=Alex&cu=INR");
    expect(res.amount).toBeNull();
  });

  test("missing note returns null note", () => {
    const res = parseUpiLink("upi://pay?pa=alex@okaxis&pn=Alex&am=100&cu=INR");
    expect(res.note).toBeNull();
  });

  test("malformed: missing pa throws", () => {
    expect(() => parseUpiLink("upi://pay?pn=Alex&am=100&cu=INR")).toThrow("payee VPA");
  });

  test("malformed: invalid VPA format throws", () => {
    expect(() => parseUpiLink("upi://pay?pa=not-a-vpa&cu=INR")).toThrow("payee VPA");
  });

  test("unsupported currency throws", () => {
    expect(() => parseUpiLink("upi://pay?pa=alex@okaxis&am=100&cu=USD")).toThrow("currency 'USD'");
  });

  test("unsupported QR content throws", () => {
    expect(() => parseUpiLink("https://example.com")).toThrow("not a UPI payment link");
  });

  test("encoded query parameters are decoded", () => {
    const res = parseUpiLink("upi://pay?pa=alex%40okaxis&pn=Alex%20Kumar&tn=Hello%20World%21");
    expect(res.vpa).toBe("alex@okaxis");
    expect(res.payeeName).toBe("Alex Kumar");
    expect(res.note).toBe("Hello World!");
  });

  test("tid reference fallback works", () => {
    const res = parseUpiLink("upi://pay?pa=alex@okaxis&am=100&cu=INR&tid=TXN456");
    expect(res.reference).toBe("TXN456");
  });

  test("isUpiLink detects valid links", () => {
    expect(isUpiLink("upi://pay?pa=alex@okaxis")).toBe(true);
    expect(isUpiLink("UPI://PAY?PA=ALEX@OKAXIS")).toBe(true);
    expect(isUpiLink("upi://pay?pa=alex@okaxis&am=100")).toBe(true);
  });

  test("isUpiLink rejects non-UPI", () => {
    expect(isUpiLink("https://example.com")).toBe(false);
    expect(isUpiLink("plain text")).toBe(false);
    expect(isUpiLink("")).toBe(false);
  });
});