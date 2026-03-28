"use client";

import { ApolloProvider } from "@apollo/client";
import { ReactNode, useMemo } from "react";
import { getApolloClient } from "./client";

type ApolloWrapperProps = {
  children: ReactNode;
};

export default function ApolloWrapper({ children }: ApolloWrapperProps) {
  const client = useMemo(() => getApolloClient(), []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
