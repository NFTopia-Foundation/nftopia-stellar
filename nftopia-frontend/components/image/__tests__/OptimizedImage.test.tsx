import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/image to render a plain img for the test environment
jest.mock('next/image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: any) => {
      // Filter out non-standard DOM props that NextImage accepts
      const { priority, onLoadingComplete, placeholder, blurDataURL, ...rest } = props;
      // expose blurDataURL for tests via a data attribute
      if (blurDataURL) rest['data-blur'] = blurDataURL;
      return React.createElement('img', rest);
    },
  };
});

import OptimizedImage from '../OptimizedImage';

describe('OptimizedImage', () => {
  it('renders fallback when src is empty', () => {
    render(<OptimizedImage src={''} alt={'test alt'} fallbackSrc={'/images/fallbacks/avatar-fallback.svg'} width={40} height={40} />);
    const img = screen.getByAltText('Fallback for test alt');
    expect(img).toBeInTheDocument();
  });

  it('renders provided src when given', () => {
    render(<OptimizedImage src={'/images/fallbacks/avatar-fallback.svg'} alt={'avatar'} width={40} height={40} />);
    const img = screen.getByAltText('avatar');
    expect(img).toBeInTheDocument();
  });

  it('renders skeleton (test env shows immediately) with correct dimensions', () => {
    render(<OptimizedImage src={'/images/fallbacks/avatar-fallback.svg'} alt={'avatar'} width={80} height={60} />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    // style width/height applied
    expect(skeleton).toHaveStyle('width: 80px');
    expect(skeleton).toHaveStyle('height: 60px');
  });

  it('shows retry button on error and allows retry to trigger loading', () => {
    jest.useFakeTimers();
    render(<OptimizedImage src={'/images/broken.jpg'} alt={'broken'} width={80} height={60} />);
    const img = screen.getByAltText('broken');
    // simulate error
    act(() => {
      fireEvent.error(img);
    });
    // retry button should appear
    const retry = screen.getByText(/Retry/i);
    expect(retry).toBeInTheDocument();
    // click retry and wait for skeleton to appear
    act(() => {
      fireEvent.click(retry);
    });
    return screen.findByRole('status').then((el) => expect(el).toBeInTheDocument());
    jest.useRealTimers();
  });

  it('passes blurPlaceholder as blurDataURL to next/image', () => {
    const blur = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNkZGQiLz48L3N2Zz4=';
    render(<OptimizedImage src={'/images/avatar.svg'} alt={'blur-test'} width={40} height={40} blurPlaceholder={blur} />);
    const img = screen.getByAltText('blur-test');
    expect(img).toHaveAttribute('data-blur', blur);
  });
});
