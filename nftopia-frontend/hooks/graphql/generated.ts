import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
};

export type Auction = {
  __typename?: 'Auction';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  endTime?: Maybe<Scalars['DateTime']['output']>;
  highestBid?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  nftId?: Maybe<Scalars['ID']['output']>;
  reservePrice?: Maybe<Scalars['String']['output']>;
  sellerId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type Collection = {
  __typename?: 'Collection';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  creatorId?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type CreateListingInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  nftId: Scalars['ID']['input'];
  price: Scalars['String']['input'];
};

export type Listing = {
  __typename?: 'Listing';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currency?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  nftId?: Maybe<Scalars['ID']['output']>;
  price?: Maybe<Scalars['String']['output']>;
  sellerId?: Maybe<Scalars['ID']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createListing: Listing;
  placeBid: Auction;
};


export type MutationCreateListingArgs = {
  input: CreateListingInput;
};


export type MutationPlaceBidArgs = {
  input: PlaceBidInput;
};

export type Nft = {
  __typename?: 'NFT';
  collectionId?: Maybe<Scalars['ID']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  ownerId?: Maybe<Scalars['ID']['output']>;
  tokenId?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type PlaceBidInput = {
  amount: Scalars['String']['input'];
  auctionId: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  auction?: Maybe<Auction>;
  auctions: Array<Auction>;
  collection?: Maybe<Collection>;
  collections: Array<Collection>;
  currentUser?: Maybe<User>;
  listing?: Maybe<Listing>;
  listings: Array<Listing>;
  nft?: Maybe<Nft>;
  nfts: Array<Nft>;
  user?: Maybe<User>;
};


export type QueryAuctionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAuctionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryCollectionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCollectionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryListingArgs = {
  id: Scalars['ID']['input'];
};


export type QueryListingsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryNftArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNftsArgs = {
  collectionId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  profileImage?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  username?: Maybe<Scalars['String']['output']>;
  walletAddress?: Maybe<Scalars['String']['output']>;
};

export type UserFieldsFragment = { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, profileImage?: string | null, createdAt?: any | null, updatedAt?: any | null };

export type CollectionFieldsFragment = { __typename?: 'Collection', id: string, name?: string | null, description?: string | null, imageUrl?: string | null, creatorId?: string | null, createdAt?: any | null, updatedAt?: any | null };

export type NftFieldsFragment = { __typename?: 'NFT', id: string, tokenId?: string | null, name?: string | null, description?: string | null, imageUrl?: string | null, ownerId?: string | null, collectionId?: string | null, createdAt?: any | null, updatedAt?: any | null };

export type ListingFieldsFragment = { __typename?: 'Listing', id: string, nftId?: string | null, sellerId?: string | null, price?: string | null, currency?: string | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null };

export type AuctionFieldsFragment = { __typename?: 'Auction', id: string, nftId?: string | null, sellerId?: string | null, reservePrice?: string | null, highestBid?: string | null, endTime?: any | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null };

export type GetAuctionsQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetAuctionsQuery = { __typename?: 'Query', auctions: Array<{ __typename?: 'Auction', id: string, nftId?: string | null, sellerId?: string | null, reservePrice?: string | null, highestBid?: string | null, endTime?: any | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null }> };

export type GetAuctionByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetAuctionByIdQuery = { __typename?: 'Query', auction?: { __typename?: 'Auction', id: string, nftId?: string | null, sellerId?: string | null, reservePrice?: string | null, highestBid?: string | null, endTime?: any | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export type PlaceBidMutationVariables = Exact<{
  input: PlaceBidInput;
}>;


export type PlaceBidMutation = { __typename?: 'Mutation', placeBid: { __typename?: 'Auction', id: string, nftId?: string | null, sellerId?: string | null, reservePrice?: string | null, highestBid?: string | null, endTime?: any | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null } };

export type GetCollectionsQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetCollectionsQuery = { __typename?: 'Query', collections: Array<{ __typename?: 'Collection', id: string, name?: string | null, description?: string | null, imageUrl?: string | null, creatorId?: string | null, createdAt?: any | null, updatedAt?: any | null }> };

export type GetCollectionByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetCollectionByIdQuery = { __typename?: 'Query', collection?: { __typename?: 'Collection', id: string, name?: string | null, description?: string | null, imageUrl?: string | null, creatorId?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export type GetListingsQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetListingsQuery = { __typename?: 'Query', listings: Array<{ __typename?: 'Listing', id: string, nftId?: string | null, sellerId?: string | null, price?: string | null, currency?: string | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null }> };

export type GetListingByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetListingByIdQuery = { __typename?: 'Query', listing?: { __typename?: 'Listing', id: string, nftId?: string | null, sellerId?: string | null, price?: string | null, currency?: string | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export type CreateListingMutationVariables = Exact<{
  input: CreateListingInput;
}>;


export type CreateListingMutation = { __typename?: 'Mutation', createListing: { __typename?: 'Listing', id: string, nftId?: string | null, sellerId?: string | null, price?: string | null, currency?: string | null, status?: string | null, createdAt?: any | null, updatedAt?: any | null } };

export type GatewayHealthQueryVariables = Exact<{ [key: string]: never; }>;


export type GatewayHealthQuery = { __typename: 'Query' };

export type GetNftsQueryVariables = Exact<{
  page?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  collectionId?: InputMaybe<Scalars['ID']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetNftsQuery = { __typename?: 'Query', nfts: Array<{ __typename?: 'NFT', id: string, tokenId?: string | null, name?: string | null, description?: string | null, imageUrl?: string | null, ownerId?: string | null, collectionId?: string | null, createdAt?: any | null, updatedAt?: any | null }> };

export type GetNftByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetNftByIdQuery = { __typename?: 'Query', nft?: { __typename?: 'NFT', id: string, tokenId?: string | null, name?: string | null, description?: string | null, imageUrl?: string | null, ownerId?: string | null, collectionId?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export type GetCurrentUserQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCurrentUserQuery = { __typename?: 'Query', currentUser?: { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, profileImage?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export type GetUserByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserByIdQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: string, walletAddress?: string | null, username?: string | null, profileImage?: string | null, createdAt?: any | null, updatedAt?: any | null } | null };

export const UserFieldsFragmentDoc = gql`
    fragment UserFields on User {
  id
  walletAddress
  username
  profileImage
  createdAt
  updatedAt
}
    `;
export const CollectionFieldsFragmentDoc = gql`
    fragment CollectionFields on Collection {
  id
  name
  description
  imageUrl
  creatorId
  createdAt
  updatedAt
}
    `;
export const NftFieldsFragmentDoc = gql`
    fragment NftFields on NFT {
  id
  tokenId
  name
  description
  imageUrl
  ownerId
  collectionId
  createdAt
  updatedAt
}
    `;
export const ListingFieldsFragmentDoc = gql`
    fragment ListingFields on Listing {
  id
  nftId
  sellerId
  price
  currency
  status
  createdAt
  updatedAt
}
    `;
export const AuctionFieldsFragmentDoc = gql`
    fragment AuctionFields on Auction {
  id
  nftId
  sellerId
  reservePrice
  highestBid
  endTime
  status
  createdAt
  updatedAt
}
    `;
export const GetAuctionsDocument = gql`
    query GetAuctions($page: Int, $limit: Int) {
  auctions(page: $page, limit: $limit) {
    ...AuctionFields
  }
}
    ${AuctionFieldsFragmentDoc}`;

/**
 * __useGetAuctionsQuery__
 *
 * To run a query within a React component, call `useGetAuctionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAuctionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAuctionsQuery({
 *   variables: {
 *      page: // value for 'page'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetAuctionsQuery(baseOptions?: Apollo.QueryHookOptions<GetAuctionsQuery, GetAuctionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAuctionsQuery, GetAuctionsQueryVariables>(GetAuctionsDocument, options);
      }
export function useGetAuctionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAuctionsQuery, GetAuctionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAuctionsQuery, GetAuctionsQueryVariables>(GetAuctionsDocument, options);
        }
// @ts-ignore
export function useGetAuctionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAuctionsQuery, GetAuctionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionsQuery, GetAuctionsQueryVariables>;
export function useGetAuctionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionsQuery, GetAuctionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionsQuery | undefined, GetAuctionsQueryVariables>;
export function useGetAuctionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionsQuery, GetAuctionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAuctionsQuery, GetAuctionsQueryVariables>(GetAuctionsDocument, options);
        }
export type GetAuctionsQueryHookResult = ReturnType<typeof useGetAuctionsQuery>;
export type GetAuctionsLazyQueryHookResult = ReturnType<typeof useGetAuctionsLazyQuery>;
export type GetAuctionsSuspenseQueryHookResult = ReturnType<typeof useGetAuctionsSuspenseQuery>;
export type GetAuctionsQueryResult = Apollo.QueryResult<GetAuctionsQuery, GetAuctionsQueryVariables>;
export const GetAuctionByIdDocument = gql`
    query GetAuctionById($id: ID!) {
  auction(id: $id) {
    ...AuctionFields
  }
}
    ${AuctionFieldsFragmentDoc}`;

/**
 * __useGetAuctionByIdQuery__
 *
 * To run a query within a React component, call `useGetAuctionByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAuctionByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAuctionByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAuctionByIdQuery(baseOptions: Apollo.QueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables> & ({ variables: GetAuctionByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
      }
export function useGetAuctionByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
        }
// @ts-ignore
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>;
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetAuctionByIdQuery | undefined, GetAuctionByIdQueryVariables>;
export function useGetAuctionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>(GetAuctionByIdDocument, options);
        }
export type GetAuctionByIdQueryHookResult = ReturnType<typeof useGetAuctionByIdQuery>;
export type GetAuctionByIdLazyQueryHookResult = ReturnType<typeof useGetAuctionByIdLazyQuery>;
export type GetAuctionByIdSuspenseQueryHookResult = ReturnType<typeof useGetAuctionByIdSuspenseQuery>;
export type GetAuctionByIdQueryResult = Apollo.QueryResult<GetAuctionByIdQuery, GetAuctionByIdQueryVariables>;
export const PlaceBidDocument = gql`
    mutation PlaceBid($input: PlaceBidInput!) {
  placeBid(input: $input) {
    ...AuctionFields
  }
}
    ${AuctionFieldsFragmentDoc}`;
export type PlaceBidMutationFn = Apollo.MutationFunction<PlaceBidMutation, PlaceBidMutationVariables>;

/**
 * __usePlaceBidMutation__
 *
 * To run a mutation, you first call `usePlaceBidMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `usePlaceBidMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [placeBidMutation, { data, loading, error }] = usePlaceBidMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function usePlaceBidMutation(baseOptions?: Apollo.MutationHookOptions<PlaceBidMutation, PlaceBidMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<PlaceBidMutation, PlaceBidMutationVariables>(PlaceBidDocument, options);
      }
export type PlaceBidMutationHookResult = ReturnType<typeof usePlaceBidMutation>;
export type PlaceBidMutationResult = Apollo.MutationResult<PlaceBidMutation>;
export type PlaceBidMutationOptions = Apollo.BaseMutationOptions<PlaceBidMutation, PlaceBidMutationVariables>;
export const GetCollectionsDocument = gql`
    query GetCollections($page: Int, $limit: Int) {
  collections(page: $page, limit: $limit) {
    ...CollectionFields
  }
}
    ${CollectionFieldsFragmentDoc}`;

/**
 * __useGetCollectionsQuery__
 *
 * To run a query within a React component, call `useGetCollectionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCollectionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCollectionsQuery({
 *   variables: {
 *      page: // value for 'page'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetCollectionsQuery(baseOptions?: Apollo.QueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
      }
export function useGetCollectionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
        }
// @ts-ignore
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionsQuery, GetCollectionsQueryVariables>;
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionsQuery | undefined, GetCollectionsQueryVariables>;
export function useGetCollectionsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionsQuery, GetCollectionsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCollectionsQuery, GetCollectionsQueryVariables>(GetCollectionsDocument, options);
        }
export type GetCollectionsQueryHookResult = ReturnType<typeof useGetCollectionsQuery>;
export type GetCollectionsLazyQueryHookResult = ReturnType<typeof useGetCollectionsLazyQuery>;
export type GetCollectionsSuspenseQueryHookResult = ReturnType<typeof useGetCollectionsSuspenseQuery>;
export type GetCollectionsQueryResult = Apollo.QueryResult<GetCollectionsQuery, GetCollectionsQueryVariables>;
export const GetCollectionByIdDocument = gql`
    query GetCollectionById($id: ID!) {
  collection(id: $id) {
    ...CollectionFields
  }
}
    ${CollectionFieldsFragmentDoc}`;

/**
 * __useGetCollectionByIdQuery__
 *
 * To run a query within a React component, call `useGetCollectionByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCollectionByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCollectionByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetCollectionByIdQuery(baseOptions: Apollo.QueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables> & ({ variables: GetCollectionByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
      }
export function useGetCollectionByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
        }
// @ts-ignore
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>;
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetCollectionByIdQuery | undefined, GetCollectionByIdQueryVariables>;
export function useGetCollectionByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>(GetCollectionByIdDocument, options);
        }
export type GetCollectionByIdQueryHookResult = ReturnType<typeof useGetCollectionByIdQuery>;
export type GetCollectionByIdLazyQueryHookResult = ReturnType<typeof useGetCollectionByIdLazyQuery>;
export type GetCollectionByIdSuspenseQueryHookResult = ReturnType<typeof useGetCollectionByIdSuspenseQuery>;
export type GetCollectionByIdQueryResult = Apollo.QueryResult<GetCollectionByIdQuery, GetCollectionByIdQueryVariables>;
export const GetListingsDocument = gql`
    query GetListings($page: Int, $limit: Int) {
  listings(page: $page, limit: $limit) {
    ...ListingFields
  }
}
    ${ListingFieldsFragmentDoc}`;

/**
 * __useGetListingsQuery__
 *
 * To run a query within a React component, call `useGetListingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetListingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetListingsQuery({
 *   variables: {
 *      page: // value for 'page'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetListingsQuery(baseOptions?: Apollo.QueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
      }
export function useGetListingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
        }
// @ts-ignore
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingsQuery, GetListingsQueryVariables>;
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingsQuery | undefined, GetListingsQueryVariables>;
export function useGetListingsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingsQuery, GetListingsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetListingsQuery, GetListingsQueryVariables>(GetListingsDocument, options);
        }
export type GetListingsQueryHookResult = ReturnType<typeof useGetListingsQuery>;
export type GetListingsLazyQueryHookResult = ReturnType<typeof useGetListingsLazyQuery>;
export type GetListingsSuspenseQueryHookResult = ReturnType<typeof useGetListingsSuspenseQuery>;
export type GetListingsQueryResult = Apollo.QueryResult<GetListingsQuery, GetListingsQueryVariables>;
export const GetListingByIdDocument = gql`
    query GetListingById($id: ID!) {
  listing(id: $id) {
    ...ListingFields
  }
}
    ${ListingFieldsFragmentDoc}`;

/**
 * __useGetListingByIdQuery__
 *
 * To run a query within a React component, call `useGetListingByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetListingByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetListingByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetListingByIdQuery(baseOptions: Apollo.QueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables> & ({ variables: GetListingByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
      }
export function useGetListingByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
        }
// @ts-ignore
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingByIdQuery, GetListingByIdQueryVariables>;
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetListingByIdQuery | undefined, GetListingByIdQueryVariables>;
export function useGetListingByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetListingByIdQuery, GetListingByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetListingByIdQuery, GetListingByIdQueryVariables>(GetListingByIdDocument, options);
        }
export type GetListingByIdQueryHookResult = ReturnType<typeof useGetListingByIdQuery>;
export type GetListingByIdLazyQueryHookResult = ReturnType<typeof useGetListingByIdLazyQuery>;
export type GetListingByIdSuspenseQueryHookResult = ReturnType<typeof useGetListingByIdSuspenseQuery>;
export type GetListingByIdQueryResult = Apollo.QueryResult<GetListingByIdQuery, GetListingByIdQueryVariables>;
export const CreateListingDocument = gql`
    mutation CreateListing($input: CreateListingInput!) {
  createListing(input: $input) {
    ...ListingFields
  }
}
    ${ListingFieldsFragmentDoc}`;
export type CreateListingMutationFn = Apollo.MutationFunction<CreateListingMutation, CreateListingMutationVariables>;

/**
 * __useCreateListingMutation__
 *
 * To run a mutation, you first call `useCreateListingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateListingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createListingMutation, { data, loading, error }] = useCreateListingMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateListingMutation(baseOptions?: Apollo.MutationHookOptions<CreateListingMutation, CreateListingMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateListingMutation, CreateListingMutationVariables>(CreateListingDocument, options);
      }
export type CreateListingMutationHookResult = ReturnType<typeof useCreateListingMutation>;
export type CreateListingMutationResult = Apollo.MutationResult<CreateListingMutation>;
export type CreateListingMutationOptions = Apollo.BaseMutationOptions<CreateListingMutation, CreateListingMutationVariables>;
export const GatewayHealthDocument = gql`
    query GatewayHealth {
  __typename
}
    `;

/**
 * __useGatewayHealthQuery__
 *
 * To run a query within a React component, call `useGatewayHealthQuery` and pass it any options that fit your needs.
 * When your component renders, `useGatewayHealthQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGatewayHealthQuery({
 *   variables: {
 *   },
 * });
 */
export function useGatewayHealthQuery(baseOptions?: Apollo.QueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
      }
export function useGatewayHealthLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
        }
// @ts-ignore
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>): Apollo.UseSuspenseQueryResult<GatewayHealthQuery, GatewayHealthQueryVariables>;
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>): Apollo.UseSuspenseQueryResult<GatewayHealthQuery | undefined, GatewayHealthQueryVariables>;
export function useGatewayHealthSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GatewayHealthQuery, GatewayHealthQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GatewayHealthQuery, GatewayHealthQueryVariables>(GatewayHealthDocument, options);
        }
export type GatewayHealthQueryHookResult = ReturnType<typeof useGatewayHealthQuery>;
export type GatewayHealthLazyQueryHookResult = ReturnType<typeof useGatewayHealthLazyQuery>;
export type GatewayHealthSuspenseQueryHookResult = ReturnType<typeof useGatewayHealthSuspenseQuery>;
export type GatewayHealthQueryResult = Apollo.QueryResult<GatewayHealthQuery, GatewayHealthQueryVariables>;
export const GetNftsDocument = gql`
    query GetNfts($page: Int, $limit: Int, $collectionId: ID, $ownerId: ID) {
  nfts(page: $page, limit: $limit, collectionId: $collectionId, ownerId: $ownerId) {
    ...NftFields
  }
}
    ${NftFieldsFragmentDoc}`;

/**
 * __useGetNftsQuery__
 *
 * To run a query within a React component, call `useGetNftsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftsQuery({
 *   variables: {
 *      page: // value for 'page'
 *      limit: // value for 'limit'
 *      collectionId: // value for 'collectionId'
 *      ownerId: // value for 'ownerId'
 *   },
 * });
 */
export function useGetNftsQuery(baseOptions?: Apollo.QueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
      }
export function useGetNftsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
        }
// @ts-ignore
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftsQuery, GetNftsQueryVariables>;
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftsQuery | undefined, GetNftsQueryVariables>;
export function useGetNftsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftsQuery, GetNftsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftsQuery, GetNftsQueryVariables>(GetNftsDocument, options);
        }
export type GetNftsQueryHookResult = ReturnType<typeof useGetNftsQuery>;
export type GetNftsLazyQueryHookResult = ReturnType<typeof useGetNftsLazyQuery>;
export type GetNftsSuspenseQueryHookResult = ReturnType<typeof useGetNftsSuspenseQuery>;
export type GetNftsQueryResult = Apollo.QueryResult<GetNftsQuery, GetNftsQueryVariables>;
export const GetNftByIdDocument = gql`
    query GetNftById($id: ID!) {
  nft(id: $id) {
    ...NftFields
  }
}
    ${NftFieldsFragmentDoc}`;

/**
 * __useGetNftByIdQuery__
 *
 * To run a query within a React component, call `useGetNftByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNftByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNftByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetNftByIdQuery(baseOptions: Apollo.QueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables> & ({ variables: GetNftByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
      }
export function useGetNftByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
        }
// @ts-ignore
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftByIdQuery, GetNftByIdQueryVariables>;
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetNftByIdQuery | undefined, GetNftByIdQueryVariables>;
export function useGetNftByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetNftByIdQuery, GetNftByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetNftByIdQuery, GetNftByIdQueryVariables>(GetNftByIdDocument, options);
        }
export type GetNftByIdQueryHookResult = ReturnType<typeof useGetNftByIdQuery>;
export type GetNftByIdLazyQueryHookResult = ReturnType<typeof useGetNftByIdLazyQuery>;
export type GetNftByIdSuspenseQueryHookResult = ReturnType<typeof useGetNftByIdSuspenseQuery>;
export type GetNftByIdQueryResult = Apollo.QueryResult<GetNftByIdQuery, GetNftByIdQueryVariables>;
export const GetCurrentUserDocument = gql`
    query GetCurrentUser {
  currentUser {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

/**
 * __useGetCurrentUserQuery__
 *
 * To run a query within a React component, call `useGetCurrentUserQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCurrentUserQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCurrentUserQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCurrentUserQuery(baseOptions?: Apollo.QueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
      }
export function useGetCurrentUserLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
        }
// @ts-ignore
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>): Apollo.UseSuspenseQueryResult<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>): Apollo.UseSuspenseQueryResult<GetCurrentUserQuery | undefined, GetCurrentUserQueryVariables>;
export function useGetCurrentUserSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetCurrentUserQuery, GetCurrentUserQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetCurrentUserQuery, GetCurrentUserQueryVariables>(GetCurrentUserDocument, options);
        }
export type GetCurrentUserQueryHookResult = ReturnType<typeof useGetCurrentUserQuery>;
export type GetCurrentUserLazyQueryHookResult = ReturnType<typeof useGetCurrentUserLazyQuery>;
export type GetCurrentUserSuspenseQueryHookResult = ReturnType<typeof useGetCurrentUserSuspenseQuery>;
export type GetCurrentUserQueryResult = Apollo.QueryResult<GetCurrentUserQuery, GetCurrentUserQueryVariables>;
export const GetUserByIdDocument = gql`
    query GetUserById($id: ID!) {
  user(id: $id) {
    ...UserFields
  }
}
    ${UserFieldsFragmentDoc}`;

/**
 * __useGetUserByIdQuery__
 *
 * To run a query within a React component, call `useGetUserByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetUserByIdQuery(baseOptions: Apollo.QueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables> & ({ variables: GetUserByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
      }
export function useGetUserByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
        }
// @ts-ignore
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByIdQuery, GetUserByIdQueryVariables>;
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>): Apollo.UseSuspenseQueryResult<GetUserByIdQuery | undefined, GetUserByIdQueryVariables>;
export function useGetUserByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetUserByIdQuery, GetUserByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetUserByIdQuery, GetUserByIdQueryVariables>(GetUserByIdDocument, options);
        }
export type GetUserByIdQueryHookResult = ReturnType<typeof useGetUserByIdQuery>;
export type GetUserByIdLazyQueryHookResult = ReturnType<typeof useGetUserByIdLazyQuery>;
export type GetUserByIdSuspenseQueryHookResult = ReturnType<typeof useGetUserByIdSuspenseQuery>;
export type GetUserByIdQueryResult = Apollo.QueryResult<GetUserByIdQuery, GetUserByIdQueryVariables>;