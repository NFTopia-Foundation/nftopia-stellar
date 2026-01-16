import { useMemo } from "react";
import { useAuth } from "../features/auth/store/authStore";
import { useMarketplace } from "../features/marketplace/store/marketplaceStore";
import { useNFTs } from "../features/nft/store/nftStore";
import { useUser, useUserProfile } from "../features/user/store/userStore";

export const useStore = () => {
  const auth = useAuth();
  const user = useUser();
  const profile = useUserProfile();
  const nft = useNFTs();
  const marketplace = useMarketplace();

  return useMemo(
    () => ({ auth, user, profile, nft, marketplace }),
    [auth, user, profile, nft, marketplace]
  );
};

export { useAuth, useMarketplace, useNFTs, useUser, useUserProfile };
