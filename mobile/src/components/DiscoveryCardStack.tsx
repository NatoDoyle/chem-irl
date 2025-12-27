import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  ActivityIndicator,
  Text,
} from 'react-native';
import { FeedItem } from '../lib/types';
import DiscoveryCard from './DiscoveryCard';
import { BRAND_COLORS } from '../config/brand';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface DiscoveryCardStackProps {
  feed: (FeedItem & { photos: string[] })[];
  onLike: (userId: string) => void;
  onPass: (userId: string) => void;
  onRefresh: () => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  loadMoreThreshold?: number;
}

export default function DiscoveryCardStack({
  feed,
  onLike,
  onPass,
  onRefresh,
  onLoadMore,
  loadingMore = false,
  hasMore = true,
  loadMoreThreshold = 5,
}: DiscoveryCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position] = useState(new Animated.ValueXY());

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      position.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        // Swipe right - Like
        handleSwipeRight();
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        // Swipe left - Pass
        handleSwipeLeft();
      } else {
        // Return to center
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const handleSwipeRight = () => {
    if (currentIndex >= feed.length) return;

    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      onLike(feed[currentIndex].user_id);
      setCurrentIndex(currentIndex + 1);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const handleSwipeLeft = () => {
    if (currentIndex >= feed.length) return;

    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      onPass(feed[currentIndex].user_id);
      setCurrentIndex(currentIndex + 1);
      position.setValue({ x: 0, y: 0 });
    });
  };

  const handleLikeButton = () => {
    if (currentIndex < feed.length) {
      handleSwipeRight();
    }
  };

  const handlePassButton = () => {
    if (currentIndex < feed.length) {
      handleSwipeLeft();
    }
  };

  // Reset position when feed changes
  useEffect(() => {
    if (currentIndex >= feed.length) {
      position.setValue({ x: 0, y: 0 });
    }
  }, [feed.length, currentIndex, position]);

  // Load more when approaching end of feed
  useEffect(() => {
    const remainingCards = feed.length - currentIndex;
    if (
      onLoadMore &&
      hasMore &&
      !loadingMore &&
      remainingCards <= loadMoreThreshold &&
      feed.length > 0
    ) {
      onLoadMore();
    }
  }, [currentIndex, feed.length, hasMore, loadingMore, loadMoreThreshold, onLoadMore]);

  const getCardStyle = (index: number) => {
    const isTopCard = index === currentIndex;
    const translateX = isTopCard ? position.x : 0;
    const scale = isTopCard ? 1 : 0.95;
    const opacity = isTopCard ? 1 : 0.8;

    return {
      transform: [{ translateX }, { scale }],
      opacity,
      zIndex: feed.length - index,
    };
  };

  const visibleCards = feed.slice(currentIndex, currentIndex + 3);

  if (visibleCards.length === 0) {
    return null;
  }

  const remainingCards = feed.length - currentIndex;

  return (
    <View style={styles.container}>
      {visibleCards.map((item, index) => {
        const actualIndex = currentIndex + index;
        const isTopCard = index === 0;

        return (
          <Animated.View
            key={item.user_id}
            style={[styles.cardContainer, getCardStyle(actualIndex)]}
            {...(isTopCard ? panResponder.panHandlers : {})}
          >
            <DiscoveryCard
              item={item}
              onLike={isTopCard ? handleLikeButton : undefined}
              onPass={isTopCard ? handlePassButton : undefined}
            />
          </Animated.View>
        );
      })}
      {loadingMore && (
        <View style={styles.loadingMoreContainer}>
          <ActivityIndicator size="small" color={BRAND_COLORS.primary} />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      )}
      {!hasMore && remainingCards <= 3 && remainingCards > 0 && (
        <View style={styles.endContainer}>
          <Text style={styles.endText}>You've reached the end of the feed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH - 32,
    height: '80%',
    maxHeight: 600,
  },
  loadingMoreContainer: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingMoreText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  endContainer: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
});
