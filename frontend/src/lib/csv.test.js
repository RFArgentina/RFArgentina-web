import { escapeCsvCell, neutralizeCsvFormula } from "./csv";

describe("CSV formula protection", () => {
  test.each(["=1+1", "+SUM(A1:A2)", "-10+20", "@SUM(A1:A2)", "   =CMD(...)", "\t+1"]) (
    "neutralizes formula-like cell %s",
    (input) => expect(neutralizeCsvFormula(input)).toBe(`'${input}`)
  );

  it("keeps ordinary values and escapes CSV quotes", () => {
    expect(escapeCsvCell("texto normal")).toBe('"texto normal"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });
});
