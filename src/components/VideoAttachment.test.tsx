/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { VideoAttachment } from "./VideoAttachment";
import type { ChatAttachment } from "@/lib/types";

function videoAtt(overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: "att_v1",
    name: "clip.mov",
    mimeType: "video/quicktime",
    kind: "file",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoAttachment", () => {
  it("renders an inline <video> when a local dataUrl is present", () => {
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({ dataUrl: "data:video/quicktime;base64,AAAA" })}
        isUser
      />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.getAttribute("src")).toBe(
      "data:video/quicktime;base64,AAAA",
    );
    expect(video!.hasAttribute("controls")).toBe(true);
    expect(video!.getAttribute("playsinline")).not.toBeNull();
  });

  it("prefers dataUrl over a mediaId endpoint", () => {
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({
          dataUrl: "data:video/quicktime;base64,BBBB",
          mediaId: "media_abc",
        })}
        isUser={false}
        vaultChecked
      />,
    );
    const video = container.querySelector("video");
    expect(video!.getAttribute("src")).toBe(
      "data:video/quicktime;base64,BBBB",
    );
  });

  it("uses the server mediaId endpoint when vault has been checked", () => {
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({ mediaId: "media_xyz" })}
        isUser={false}
        vaultChecked
      />,
    );
    const video = container.querySelector("video");
    expect(video!.getAttribute("src")).toBe("/api/media/media_xyz");
  });

  it("shows a loading placeholder while the vault is unresolved", () => {
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({ mediaId: "media_pending" })}
        isUser={false}
      />,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(
      container.querySelector('[aria-label="Loading video"]'),
    ).not.toBeNull();
  });

  it("degrades to an unavailable chip when the media cannot be reached", () => {
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({ mediaId: "media_gone" })}
        isUser={false}
        vaultChecked
        loadFailed
      />,
    );
    expect(container.querySelector("video")).toBeNull();
    expect(container.textContent).toContain("clip.mov");
    expect(container.querySelector('[title*="unavailable"]')).not.toBeNull();
  });

  it("reports a failed /api/media load so the parent can degrade the chip", () => {
    const onLoadFailed = vi.fn();
    const { container } = render(
      <VideoAttachment
        attachment={videoAtt({ mediaId: "media_net" })}
        isUser={false}
        vaultChecked
        onLoadFailed={onLoadFailed}
      />,
    );
    const video = container.querySelector("video")!;
    fireEvent.error(video);
    expect(onLoadFailed).toHaveBeenCalledWith("att_v1");
  });

  it("downloads the video through the download button", () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { getByTitle } = render(
      <VideoAttachment
        attachment={videoAtt({
          dataUrl: "data:video/quicktime;base64,CCCC",
          name: "trip.mov",
        })}
        isUser
      />,
    );
    fireEvent.click(getByTitle("Download trip.mov"));
    expect(clickSpy).toHaveBeenCalled();
  });
});
