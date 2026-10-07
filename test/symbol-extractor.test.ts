import { strict as assert } from "node:assert";
import { test } from "node:test";
import ts from "typescript";

import { extractSymbols } from "../src/symbol-extractor.js";

test("extracts identifier-assigned arrow and function expressions as functions", () => {
  const filePath = "src/users.ts";
  const source = [
    "const getUser = () => {};",
    "const handleSubmit = async () => {};",
    "const Component = () => {",
    "  return null;",
    "};",
    "const getOtherUser = function () {};",
    'const userName = "Ada";',
    "function declaredFunction() {}",
  ].join("\n");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const symbols = extractSymbols(sourceFile, filePath);

  assert.deepEqual(
    symbols.map(({ name, type }) => ({ name, type })),
    [
      { name: "getUser", type: "function" },
      { name: "handleSubmit", type: "function" },
      { name: "Component", type: "function" },
      { name: "getOtherUser", type: "function" },
      { name: "userName", type: "variable" },
      { name: "declaredFunction", type: "function" },
    ],
  );

  const getUser = symbols.find((symbol) => symbol.name === "getUser");
  assert.ok(getUser);
  assert.equal(getUser.id, "src/users.ts:getUser:1");
  assert.deepEqual(getUser.location, {
    file: filePath,
    startLine: 1,
    startColumn: 7,
    endLine: 1,
    endColumn: "const getUser = () => {}".length + 1,
  });

  const component = symbols.find((symbol) => symbol.name === "Component");
  assert.ok(component);
  assert.equal(component.id, "src/users.ts:Component:3");
  assert.deepEqual(component.location, {
    file: filePath,
    startLine: 3,
    startColumn: 7,
    endLine: 5,
    endColumn: 2,
  });
});

test("extracts class methods and constructors with unique identities and locations", () => {
  const filePath = "src/services.ts";
  const source = [
    "class AuthService {",
    "  constructor() {",
    "    return;",
    "  }",
    "  async login() {",
    "    return true;",
    "  }",
    "  private logout() {}",
    "  static create() {}",
    "}",
    "class PaymentService {",
    "  login() {}",
    "}",
  ].join("\n");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const symbols = extractSymbols(sourceFile, filePath);
  const findSymbol = (name: string, line: number) => {
    const symbol = symbols.find(
      (candidate) =>
        candidate.name === name && candidate.location.startLine === line,
    );

    assert.ok(symbol, `Expected ${name} symbol on line ${line}`);
    return symbol;
  };

  const authService = findSymbol("AuthService", 1);
  const paymentService = findSymbol("PaymentService", 11);
  const constructor = findSymbol("constructor", 2);
  const authLogin = findSymbol("login", 5);
  const logout = findSymbol("logout", 8);
  const create = findSymbol("create", 9);
  const paymentLogin = findSymbol("login", 12);

  assert.equal(authService.type, "class");
  assert.equal(paymentService.type, "class");
  assert.equal(constructor.type, "function");
  assert.equal(authLogin.type, "function");
  assert.equal(logout.type, "function");
  assert.equal(create.type, "function");
  assert.equal(paymentLogin.type, "function");

  assert.equal(constructor.name, "constructor");
  assert.equal(constructor.parentId, authService.id);
  assert.equal(authLogin.parentId, authService.id);
  assert.equal(logout.parentId, authService.id);
  assert.equal(create.parentId, authService.id);
  assert.equal(paymentLogin.parentId, paymentService.id);
  assert.notEqual(authLogin.id, paymentLogin.id);

  assert.equal(constructor.id, `${authService.id}.constructor:2`);
  assert.equal(authLogin.id, `${authService.id}.login:5`);
  assert.equal(paymentLogin.id, `${paymentService.id}.login:12`);
  assert.deepEqual(constructor.location, {
    file: filePath,
    startLine: 2,
    startColumn: 3,
    endLine: 4,
    endColumn: 4,
  });
  assert.deepEqual(authLogin.location, {
    file: filePath,
    startLine: 5,
    startColumn: 3,
    endLine: 7,
    endColumn: 4,
  });
  assert.deepEqual(logout.location, {
    file: filePath,
    startLine: 8,
    startColumn: 3,
    endLine: 8,
    endColumn: "  private logout() {}".length + 1,
  });
  assert.deepEqual(create.location, {
    file: filePath,
    startLine: 9,
    startColumn: 3,
    endLine: 9,
    endColumn: "  static create() {}".length + 1,
  });
});
