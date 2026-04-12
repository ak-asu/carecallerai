import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "action-text"?: string;
        dismissible?: string;
        "end-call-text"?: string;
        "expand-text"?: string;
        "listening-text"?: string;
        "override-language"?: string;
        "signed-url"?: string;
        "speaking-text"?: string;
        "start-call-text"?: string;
        variant?: string;
      };
    }
  }
}
