import { gql } from "@apollo/client";

export const LIKE_COLLECTION_MUTATION = gql`
  mutation LikeCollection($input: LikeCollectionInput!) {
    likeCollection(input: $input) {
      success
      collectionId
      likesCount
      userLiked
      message
    }
  }
`;

export const UNLIKE_COLLECTION_MUTATION = gql`
  mutation UnlikeCollection($input: UnlikeCollectionInput!) {
    unlikeCollection(input: $input) {
      success
      collectionId
      likesCount
      userLiked
      message
    }
  }
`;

export const GET_COLLECTION_LIKES_QUERY = gql`
  query GetCollectionLikes($collectionId: ID!) {
    collectionLikes(collectionId: $collectionId) {
      count
      isLiked
    }
  }
`;