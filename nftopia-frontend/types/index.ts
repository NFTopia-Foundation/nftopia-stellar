export interface Collection {
  id: string;
  title: string;
  creatorName: string;
  creatorImage: string; // Path to creator's avatar image
  images: {
    main: string; // Path to main collection image (larger grid item)
    secondary1: string; // Path to first smaller grid item image
    secondary2: string; // Path to second smaller grid item image
  };
  likes: number;
} 