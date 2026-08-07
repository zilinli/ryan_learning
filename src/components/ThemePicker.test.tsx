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

  it("shows a compact trigger; the four options live in a collapsed menu", () => {
    const { container } = render(<ThemePicker />);
    const trigger = container.querySelector('button[aria-haspopup="menu"]');
    expect(trigger).not.toBeNull();
    // Options are collapsed until the trigger is opened
    expect(container.querySelector('button[role="menuitemradio"]')).toBeNull();
    fireEvent.click(trigger!);
    const options = container.querySelectorAll('button[role="menuitemradio"]');
    expect(options.length).toBe(4);
    expect(container.querySelector('button[aria-label="Light theme"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Dark theme"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Light blue theme"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Light green theme"]'),
    ).not.toBeNull();
  });

  it("clicking a theme sets data-theme and persists spark.theme", () => {
    const { container } = render(<ThemePicker />);
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
    fireEvent.click(
      container.querySelector('button[aria-label="Light green theme"]')!,
    );
    expect(document.documentElement.dataset.theme).toBe("light-green");
    expect(localStorage.getItem("spark.theme")).toBe("light-green");
  });

  it("clicking dark clears the legacy spark.dark flag", () => {
    localStorage.setItem("spark.dark", "true");
    const { container } = render(<ThemePicker />);
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
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

  it("defaults to light-green when nothing is saved", () => {
    render(<ThemePicker />);
    expect(document.documentElement.dataset.theme).toBe("light-green");
    expect(localStorage.getItem("spark.theme")).toBe("light-green");
  });

  it("closes the menu on Escape", () => {
    const { container } = render(<ThemePicker />);
    fireEvent.click(container.querySelector('button[aria-haspopup="menu"]')!);
    expect(container.querySelector('button[role="menuitemradio"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector('button[role="menuitemradio"]')).toBeNull();
  });
});
