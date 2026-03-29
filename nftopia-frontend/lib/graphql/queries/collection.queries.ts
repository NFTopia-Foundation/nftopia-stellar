import { gql } from "@apollo/client";
import { COLLECTION_FIELDS_FRAGMENT } from "../fragments";

export const GET_COLLECTIONS_QUERY = gql`
  query GetCollections($page: Int, $limit: Int) {
    collections(page: $page, limit: $limit) {
      ...CollectionFields
    }
  }
  ${COLLECTION_FIELDS_FRAGMENT}
`;

export const GET_COLLECTION_BY_ID_QUERY = gql`
  query GetCollectionById($id: ID!) {
    collection(id: $id) {
      ...CollectionFields
    }
  }
  ${COLLECTION_FIELDS_FRAGMENT}
`;
