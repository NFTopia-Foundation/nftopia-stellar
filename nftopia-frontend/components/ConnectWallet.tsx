"use client";

import {
  useConnect,
  useAccount,
  useDisconnect,
  Connector,
} from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";
import { useTranslation } from "@/hooks/useTranslation";

export default function ConnectWallet() {
  const { t } = useTranslation();
  const { connect, connectors } = useConnect();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  async function connectWallet() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) {
      return;
    }
    await connect({ connector: connector as Connector });
  }
  if (!address) {
    return (
      <button
        onClick={connectWallet}
        className=" hidden xl:block rounded-full px-6 py-2 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90"
      >
        {t("connectWallet.connect")}
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="p-2 bg-[#4e3bff] rounded-lg ">
        {t("connectWallet.connected")}: {address?.slice(0, 6)}...
        {address?.slice(-4)}
      </div>
      <button
        onClick={() => disconnect()}
        className=" lg:block rounded-full px-6 py-2 bg-gradient-to-r from-[#4e3bff] to-[#9747ff] text-white hover:opacity-90"
      >
        {t("connectWallet.disconnect")}
      </button>
    </div>
  );
}
