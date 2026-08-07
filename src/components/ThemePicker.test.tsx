/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ThemePicker } from "../components/ThemePicker";

describe("ThemePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("renders all four theme options", () => {
    const { container } = render(<ThemePicker />);
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(4);
    expect(container.querySelector('button[aria-label="Light theme"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Dark theme"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Blue theme"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Green theme"]')).not.toBeNull();
  });

  it("clicking a theme sets data-theme and persists spark.theme", () => {
    const { container } = render(<ThemePicker />);
    fireEvent.click(container.querySelector('button[aria-label="Green theme"]')!);
    expect(document.documentElement.dataset.theme).toBe("light-green");
    expect(localStorage.getItem("spark.theme")).toBe("light-green");
  });

  it("clicking dark clears the legacy spark.dark flag", () => {
    localStorage.setItem("spark.dark", "true");
    const { container } = render(<ThemePicker />);
    fireEvent.click(container.querySelector('button[aria-label="Dark theme"]')!);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("spark.dark")).toBeNull();
    expect(localStorage.getItem("spark.theme")).toBe("dark");
  });

  it("restores the saved theme on mount", () => {
    localStorage.setItem("spark.theme", "light-blue");
    render(<ThemePicker />);
    expect(document.documentElement.dataset.theme).toBe("light-blue");
  });
});
