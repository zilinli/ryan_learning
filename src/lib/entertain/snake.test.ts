import { describe, expect, it } from "vitest";
import { initSnake, setDirection, stepSnake } from "./snake";

describe("Snake engine", () => {
  it("starts with length 3 moving right", () => {
    const s = initSnake();
    expect(s.snake).toHaveLength(3);
    expect(s.dir).toBe("R");
    expect(s.status).toBe("playing");
  });

  it("step advances head", () => {
    const s0 = initSnake();
    const head = s0.snake[0];
    const s1 = stepSnake(s0);
    expect(s1.snake[0].c).toBe(head.c + 1);
    expect(s1.snake).toHaveLength(3);
  });

  it("rejects 180° reverse", () => {
    const s0 = initSnake();
    const s1 = setDirection(s0, "L");
    expect(s1.pendingDir).toBe("R");
  });

  it("dies on wall", () => {
    let s = initSnake(5, 5);
    s = { ...s, snake: [{ r: 0, c: 0 }], dir: "U", pendingDir: "U" };
    s = stepSnake(s);
    expect(s.status).toBe("over");
  });

  it("grows when eating food", () => {
    let s = initSnake(8, 8);
    const head = s.snake[0];
    s = {
      ...s,
      food: { r: head.r, c: head.c + 1 },
      dir: "R",
      pendingDir: "R",
    };
    const len = s.snake.length;
    s = stepSnake(s);
    expect(s.snake.length).toBe(len + 1);
    expect(s.score).toBe(10);
  });
});
