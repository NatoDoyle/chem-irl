import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { FeedItem } from '../lib/types';
import { BRAND_COLORS } from '../config/brand';

interface DiscoveryCardProps {
  item: FeedItem & { photos: string[] };
  onLike?: () => void;
  onPass?: () => void;
}

export default function DiscoveryCard({ item, onLike, onPass }: DiscoveryCardProps) {
  const primaryPhoto = item.photos[0] || 'https://via.placeholder.com/400x500';

  return (
    <View style={styles.card}>
      <Image source={{ uri: primaryPhoto }} style={styles.image} />

      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.headline}>{item.headline || 'No headline'}</Text>
          <ScrollView style={styles.bioContainer}>
            <Text style={styles.bio}>{item.bio || 'No bio'}</Text>
          </ScrollView>

          {item.availability_summary && (
            <Text style={styles.availability}>{item.availability_summary}</Text>
          )}

          <View style={styles.scores}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Speed</Text>
              <Text style={styles.scoreValue}>{item.action_speed}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Quality</Text>
              <Text style={styles.scoreValue}>{item.profile_quality}</Text>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Reliability</Text>
              <Text style={styles.scoreValue}>{item.reliability}</Text>
            </View>
          </View>
        </View>

        {onLike && onPass && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionButton, styles.passButton]} onPress={onPass}>
              <Text style={styles.passButtonText}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={onLike}>
              <Text style={styles.likeButtonText}>Like</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '60%',
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  bioContainer: {
    maxHeight: 100,
    marginBottom: 12,
  },
  bio: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    lineHeight: 22,
  },
  availability: {
    fontSize: 14,
    color: BRAND_COLORS.primary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  scores: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: BRAND_COLORS.text[600],
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: BRAND_COLORS.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: BRAND_COLORS.text[600],
  },
  passButtonText: {
    color: BRAND_COLORS.text[900],
    fontSize: 16,
    fontWeight: '600',
  },
  likeButton: {
    backgroundColor: BRAND_COLORS.primary,
  },
  likeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
