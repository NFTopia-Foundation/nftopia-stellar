import { act, render } from "@testing-library/react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

type ObserverEntry = { isIntersecting: boolean };
type ObserverCallback = (entries: ObserverEntry[]) => void;

interface MockObserver {
  callback: ObserverCallback;
  options?: IntersectionObserverInit;
  observe: jest.Mock;
  unobserve: jest.Mock;
  disconnect: jest.Mock;
}

let observers: MockObserver[] = [];

beforeEach(() => {
  observers = [];

  class MockIntersectionObserver {
    callback: ObserverCallback;
    options?: IntersectionObserverInit;
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();

    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      observers.push(this as unknown as MockObserver);
    }
  }

  (globalThis as unknown as { IntersectionObserver: unknown })
    .IntersectionObserver = MockIntersectionObserver;
});

function Harness({
  onLoadMore,
  enabled,
}: {
  onLoadMore: () => void;
  enabled?: boolean;
}) {
  const ref = useInfiniteScroll<HTMLDivElement>({ onLoadMore, enabled });
  return <div data-testid="sentinel" ref={ref} />;
}

describe("useInfiniteScroll", () => {
  it("calls onLoadMore when the sentinel intersects", () => {
    const onLoadMore = jest.fn();
    render(<Harness onLoadMore={onLoadMore} />);

    expect(observers).toHaveLength(1);
    act(() => observers[0].callback([{ isIntersecting: true }]));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("ignores notifications while the sentinel is off-screen", () => {
    const onLoadMore = jest.fn();
    render(<Harness onLoadMore={onLoadMore} />);

    act(() => observers[0].callback([{ isIntersecting: false }]));

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("does not observe the sentinel when disabled", () => {
    render(<Harness onLoadMore={jest.fn()} enabled={false} />);

    expect(observers).toHaveLength(0);
  });

  it("prefetches ahead of the viewport with a large root margin", () => {
    render(<Harness onLoadMore={jest.fn()} />);

    expect(observers[0].options?.rootMargin).toBe("0px 0px 1200px 0px");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Harness onLoadMore={jest.fn()} />);
    const observer = observers[0];

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
