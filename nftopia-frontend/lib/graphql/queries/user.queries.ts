import { gql } from "@apollo/client";
import { USER_FIELDS_FRAGMENT } from "../fragments";

export const GET_CURRENT_USER_QUERY = gql`
  query GetCurrentUser {
    currentUser {
      ...UserFields
    }
  }
  ${USER_FIELDS_FRAGMENT}
`;

export const GET_USER_BY_ID_QUERY = gql`
  query GetUserById($id: ID!) {
    user(id: $id) {
      ...UserFields
    }
  }
  ${USER_FIELDS_FRAGMENT}
`;
