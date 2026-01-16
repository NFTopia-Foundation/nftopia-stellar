# UI Components

This directory contains reusable UI components for the NFTopia platform.

## StyledButton Component

A highly customizable button component with cosmic theme support and enhanced accessibility.

### Features
- Multiple variants including cosmic theme
- Loading state with spinner
- Full keyboard navigation support
- Dark mode support
- Neumorphic design with optimized shadows
- Smooth hover and active state animations

### Usage

```tsx
import { Button } from "@/components/ui/button";

// Default button
<Button>Click me</Button>

// Cosmic themed button with loading state
<Button 
  variant="cosmic"
  loading={true}
  loadingText="Processing..."
>
  Mint NFT
</Button>

// Large secondary button
<Button variant="secondary" size="lg">
  View Collection
</Button>
```

### Props

- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "cosmic"
- `size`: "default" | "sm" | "lg" | "icon"
- `loading`: boolean
- `loadingText`: string
- `asChild`: boolean - Merge props onto child element
- All HTML button attributes

## ModernSearchInput Component

A modern search input component with cosmic theme integration and enhanced user feedback.

### Features
- Smooth focus and hover animations
- Loading state indicator
- Clear button when input has value
- Dark mode support
- Full keyboard navigation
- ARIA attributes for accessibility
- Customizable label support

### Usage

```tsx
import { SearchInput } from "@/components/ui/search-input";

// Basic search input
<SearchInput placeholder="Search NFTs..." />

// With label and loading state
<SearchInput 
  label="Search Collections"
  isSearching={true}
  onClear={() => setValue("")}
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Props

- `label`: string - Optional label above input
- `isSearching`: boolean - Shows loading spinner
- `onClear`: () => void - Function to clear input value
- `containerClassName`: string - Class for outer container
- `className`: string - Class for input element
- All HTML input attributes
