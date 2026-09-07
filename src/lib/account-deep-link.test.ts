import { afterEach, describe, expect, it } from "vitest";
import {
  accountDeepLinkParamFromUrl,
  applyAccountDeepLink,
  resolveDeepLinkAccountId,
} from "./account-deep-link";
import { RYAN_ACCOUNT_ID, type AccountRecord, type AccountsStore } from "./student-profile";

function acct(
  id: string,
  name: string,
): AccountRecord {
  return {
    id,
    profile: {
      name,
      age: 10,
      grade: 4,
      gradeBand: "elementary",
      school: "",
      curriculum: null,
      preferredChinese: "yue",
      englishLevel: "developing",
      stronger: [],
      focusAreas: [],
    },
    role: "student",
    createdAt: 1,
    updatedAt: 1,
  };
}

function store(activeId: string, accounts: AccountRecord[]): AccountsStore {
  return { version: 1, activeId, accounts };
}

afterEach(() => {
  // @ts-expect-error test cleanup
  delete globalThis.window;
});

describe("accountDeepLinkParamFromUrl", () => {
  it("reads account query", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          search: "?account=acct_ching&session=abc",
        },
      },
      writable: true,
      configurable: true,
    });
    expect(accountDeepLinkParamFromUrl()).toBe("acct_ching");
  });

  it("allows profile name params", () => {
    Object.defineProperty(globalThis, "window", {
      value: { location: { search: "?account=Ching" } },
      writable: true,
      configurable: true,
    });
    expect(accountDeepLinkParamFromUrl()).toBe("Ching");
  });

  it("rejects empty / junk", () => {
    Object.defineProperty(globalThis, "window", {
      value: { location: { search: "?account=../etc" } },
      writable: true,
      configurable: true,
    });
    expect(accountDeepLinkParamFromUrl()).toBeNull();
  });
});

describe("resolveDeepLinkAccountId", () => {
  const accounts = [
    acct(RYAN_ACCOUNT_ID, "Ryan"),
    acct("acct_ching", "Ching"),
    acct("acct_1aee08a3-4fa9-4147-b776-0a3fa6a31874", "Ryan Lam"),
  ];

  it("maps default → Ryan", () => {
    expect(resolveDeepLinkAccountId("default", accounts)).toBe(RYAN_ACCOUNT_ID);
  });

  it("resolves by id", () => {
    expect(resolveDeepLinkAccountId("acct_ching", accounts)).toBe("acct_ching");
  });

  it("keeps unknown acct_* for later hydrate", () => {
    expect(resolveDeepLinkAccountId("acct_newkid", accounts)).toBe("acct_newkid");
  });

  it("resolves by profile name (case-insensitive)", () => {
    expect(resolveDeepLinkAccountId("ching", accounts)).toBe("acct_ching");
    expect(resolveDeepLinkAccountId("CHING", accounts)).toBe("acct_ching");
  });

  it("resolves by name slug", () => {
    expect(resolveDeepLinkAccountId("ryan-lam", accounts)).toBe(
      "acct_1aee08a3-4fa9-4147-b776-0a3fa6a31874",
    );
  });

  it("returns null for unknown names", () => {
    expect(resolveDeepLinkAccountId("Nobody", accounts)).toBeNull();
  });
});

describe("applyAccountDeepLink", () => {
  it("switches active account when id is present", () => {
    const before = store(RYAN_ACCOUNT_ID, [
      acct(RYAN_ACCOUNT_ID, "Ryan"),
      acct("acct_ching", "Ching"),
    ]);
    // Avoid localStorage side effects from switchAccount in jsdom-less env
    const ls: Record<string, string> = {};
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (k: string) => ls[k] ?? null,
          setItem: (k: string, v: string) => {
            ls[k] = v;
          },
          removeItem: (k: string) => {
            delete ls[k];
          },
        },
        location: { search: "" },
      },
      writable: true,
      configurable: true,
    });
    const result = applyAccountDeepLink(before, "acct_ching");
    expect(result.matched).toBe(true);
    expect(result.accountId).toBe("acct_ching");
    expect(result.store.activeId).toBe("acct_ching");
  });

  it("matches by name and leaves store unchanged when already active", () => {
    const before = store("acct_ching", [
      acct(RYAN_ACCOUNT_ID, "Ryan"),
      acct("acct_ching", "Ching"),
    ]);
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
        location: { search: "" },
      },
      writable: true,
      configurable: true,
    });
    const result = applyAccountDeepLink(before, "Ching");
    expect(result.matched).toBe(true);
    expect(result.store).toBe(before);
  });

  it("reports unmatched when account only known by pending id", () => {
    const before = store(RYAN_ACCOUNT_ID, [acct(RYAN_ACCOUNT_ID, "Ryan")]);
    const result = applyAccountDeepLink(before, "acct_ching");
    expect(result.matched).toBe(false);
    expect(result.accountId).toBe("acct_ching");
    expect(result.store.activeId).toBe(RYAN_ACCOUNT_ID);
  });
});
