import type { LangChainMessage } from "@assistant-ui/react-langgraph";

import type { ConversationStatePublic } from "@/lib/client";

export type TodoState = {
  todos?: ConversationStatePublic["todos"];
};

export type ArtifactState = {
  artifacts?: ConversationStatePublic["artifacts"];
};

export type ResearchState = {
  runStatus?: NonNullable<ConversationStatePublic["runStatus"]>;
  runStartedAt?: NonNullable<ConversationStatePublic["runStartedAt"]>;
  runFinishedAt?: NonNullable<ConversationStatePublic["runFinishedAt"]>;
  runError?: NonNullable<ConversationStatePublic["runError"]>;
  loadError?: string;
  stage?: NonNullable<ConversationStatePublic["stage"]>;
  plan?: NonNullable<ConversationStatePublic["plan"]>;
  researchMessages?: readonly LangChainMessage[];
  outline?: NonNullable<ConversationStatePublic["outline"]>;
  draft?: NonNullable<ConversationStatePublic["draft"]>;
  report?: NonNullable<ConversationStatePublic["report"]>;
};

export type ApplicationState = TodoState & ArtifactState & ResearchState;

declare module "@assistant-ui/react" {
  namespace Assistant {
    interface ExternalState {
      application: ApplicationState;
    }
  }
}
