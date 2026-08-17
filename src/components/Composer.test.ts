/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocks
vi.mock("./VoiceControls", () => ({
  VoiceControls: ({
    onTranscript,
  }: {
    onTranscript?: (t: string) => void;
  }) =>
    React.createElement("div", {
      "data-testid": "voice-controls",
      onClick: () => onTranscript?.("Voice input text"),
    }),
}));

vi.mock("./CameraCapture", () => ({
  CameraCapture: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
  }) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "camera-capture" },
          React.createElement("button", {
            "data-testid": "close-camera",
            onClick: onClose,
          }),
        )
      : null,
}));

vi.mock("@/lib/file-payload", () => ({
  attachmentFromCameraCapture: vi.fn((p) => ({
    id: "cam-1",
    name: "camera.jpg",
    mimeType: p.mimeType || "image/jpeg",
    kind: "image",
    dataUrl: p.dataUrl || "data:image/jpeg;base64,test",
  })),
  filesToAttachments: vi.fn(() =>
    Promise.resolve({
      items: [
        {
          id: "f1",
          name: "test.pdf",
          mimeType: "application/pdf",
          kind: "file",
          data: "pdf-data",
        },
      ],
      errors: [],
    }),
  ),
}));

vi.mock("@/lib/attachments", () => ({
  MAX_ATTACHMENTS: 5,
  FILE_INPUT_ACCEPT: ["image/*", "application/pdf"],
  resolveFilePickerAccept: (accept: string[] | string) => accept,
}));

vi.mock("@/lib/speech-player", () => ({
  getSharedSpeechEngine: () => ({
    unlock: vi.fn(() => Promise.resolve()),
  }),
}));

describe("Composer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders textarea with placeholder", async () => {
    const { Composer } = await import("./Composer");
    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask anything about your homework…",
    );
    expect(textarea).toBeTruthy();
  });

  it("shows camera button with 'Snap homework' on desktop", async () => {
    const { Composer } = await import("./Composer");
    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    const cameraBtn = screen.getByRole("button", { name: /camera/i });
    expect(cameraBtn).toBeTruthy();
  });

  it("shows send button", async () => {
    const { Composer } = await import("./Composer");
    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeTruthy();
  });

  it("calls onSend with text when send button clicked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { Composer } = await import("./Composer");

    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend,
      }),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask anything about your homework…",
    );
    await user.type(textarea, "Hello tutor!");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello tutor!",
        attachments: [],
      }),
    );
  });

  it("calls onSend when Enter is pressed (no Shift)", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { Composer } = await import("./Composer");

    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend,
      }),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask anything about your homework…",
    );
    await user.type(textarea, "Quick question");
    await user.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Quick question",
      }),
    );
  });

  it("does not call onSend when Shift+Enter is pressed", async () => {
    const onSend = vi.fn();
    const { Composer } = await import("./Composer");

    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend,
      }),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask anything about your homework…",
    );

    fireEvent.change(textarea, { target: { value: "Multi-line" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    // Shift+Enter should NOT send
    expect(onSend).not.toHaveBeenCalled();
  });

  it("pressing Enter on composing does not send", async () => {
    const onSend = vi.fn();
    const { Composer } = await import("./Composer");

    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend,
      }),
    );

    const textarea = screen.getByPlaceholderText(
      "Ask anything about your homework…",
    );

    fireEvent.change(textarea, { target: { value: "Still typing" } });
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: false,
      nativeEvent: { isComposing: true },
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("has file upload input", async () => {
    const { Composer } = await import("./Composer");
    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    const uploadLabels = screen.getAllByLabelText("Upload file");
    expect(uploadLabels.length).toBeGreaterThan(0);
  });

  it("renders VoiceControls", async () => {
    const { Composer } = await import("./Composer");
    render(
      React.createElement(Composer, {
        voiceEnabled: true,
        onVoiceEnabledChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );

    const voiceControls = screen.getByTestId("voice-controls");
    expect(voiceControls).toBeTruthy();
  });
});
