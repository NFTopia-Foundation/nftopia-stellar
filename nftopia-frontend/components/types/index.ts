export interface Collection {
  id: string;
  title: string;
  creatorName: string;
  creatorImage: string; // Assuming an image/avatar for the creator
  images: {
    main: string;
    secondary1: string;
    secondary2: string;
  };
  likes: number;
} 