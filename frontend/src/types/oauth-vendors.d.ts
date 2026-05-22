/** Google Identity Services */
interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      width?: number | string;
      text?: "signin_with" | "signup_with" | "continue_with";
      locale?: string;
    },
  ) => void;
}

interface GoogleAccounts {
  id: GoogleAccountsId;
}

interface Window {
  google?: { accounts: GoogleAccounts };
  AppleID?: {
    auth: {
      init: (config: {
        clientId: string;
        scope: string;
        redirectURI: string;
        usePopup: boolean;
      }) => void;
      signIn: () => Promise<{
        authorization: { id_token: string; code?: string };
        user?: { email?: string; name?: { firstName?: string; lastName?: string } };
      }>;
    };
  };
}
