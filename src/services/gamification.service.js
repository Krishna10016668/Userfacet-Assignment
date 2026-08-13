const { getDb } = require('../database/connection');
const { generateUUID, getCurrentTimestamp } = require('../utils/helpers');
const { BADGE_DEFINITIONS } = require('../utils/constants');

/**
 * Gamification Service
 * Manages daily reading streaks, milestone achievements, and badge awarding.
 */
class GamificationService {
  /**
   * Records a user activity event (borrow, reading progress update, return)
   * and updates their consecutive reading streak.
   * 
   * @param {string} userId - Unique identifier of the patron
   * @param {string} activityType - Category of activity ('READING_PROGRESS', 'BORROW', 'RETURN')
   * @param {Object} [metadata] - Additional context payload
   * @returns {Object} Updated streak status and any newly unlocked badges
   */
  recordUserActivity(userId, activityType, metadata = {}) {
    const db = getDb();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const timestampNow = getCurrentTimestamp();

    // 1. Fetch or initialize streak record
    let streak = db.prepare('SELECT * FROM reading_streaks WHERE user_id = ?').get(userId);

    if (!streak) {
      const streakId = generateUUID();
      db.prepare(`
        INSERT INTO reading_streaks (
          id, user_id, current_streak_days, longest_streak_days, 
          last_activity_date, total_active_days, updated_at
        ) VALUES (?, ?, 1, 1, ?, 1, ?)
      `).run(streakId, userId, todayStr, timestampNow);
      streak = db.prepare('SELECT * FROM reading_streaks WHERE user_id = ?').get(userId);
    } else {
      const lastDate = streak.last_activity_date ? new Date(streak.last_activity_date) : null;
      const todayDate = new Date(todayStr);
      
      if (!lastDate) {
        db.prepare(`
          UPDATE reading_streaks 
          SET current_streak_days = 1, longest_streak_days = MAX(longest_streak_days, 1),
              last_activity_date = ?, total_active_days = total_active_days + 1, updated_at = ?
          WHERE user_id = ?
        `).run(todayStr, timestampNow, userId);
      } else {
        const diffTime = todayDate.getTime() - lastDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Consecutive day: increment streak
          const newCurrent = streak.current_streak_days + 1;
          const newLongest = Math.max(streak.longest_streak_days, newCurrent);
          db.prepare(`
            UPDATE reading_streaks 
            SET current_streak_days = ?, longest_streak_days = ?,
                last_activity_date = ?, total_active_days = total_active_days + 1, updated_at = ?
            WHERE user_id = ?
          `).run(newCurrent, newLongest, todayStr, timestampNow, userId);
        } else if (diffDays > 1) {
          // Streak broken: reset to 1
          db.prepare(`
            UPDATE reading_streaks 
            SET current_streak_days = 1,
                last_activity_date = ?, total_active_days = total_active_days + 1, updated_at = ?
            WHERE user_id = ?
          `).run(todayStr, timestampNow, userId);
        }
        // If diffDays === 0, activity was already recorded for today (no streak day increment)
      }
    }

    // 2. Evaluate and award milestone badges
    const newlyUnlockedBadges = this.evaluateAndAwardBadges(userId, metadata);

    return {
      streak: this.getUserStreak(userId),
      newly_unlocked_badges: newlyUnlockedBadges
    };
  }

  /**
   * Evaluates all badge qualification criteria and unlocks new achievements.
   * 
   * @param {string} userId - Unique identifier of the patron
   * @param {Object} [currentContext] - Context of the current action
   * @returns {Array<Object>} List of newly awarded badges
   */
  evaluateAndAwardBadges(userId, currentContext = {}) {
    const db = getDb();
    const existingBadges = db.prepare('SELECT badge_key FROM user_badges WHERE user_id = ?').all(userId);
    const existingBadgeKeys = new Set(existingBadges.map(b => b.badge_key));
    const newlyUnlocked = [];

    const awardBadge = (badgeDef) => {
      if (!existingBadgeKeys.has(badgeDef.key)) {
        const id = generateUUID();
        const now = getCurrentTimestamp();
        db.prepare(`
          INSERT OR IGNORE INTO user_badges (id, user_id, badge_key, badge_name, badge_description, icon, unlocked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, userId, badgeDef.key, badgeDef.name, badgeDef.description, badgeDef.icon, now);
        
        existingBadgeKeys.add(badgeDef.key);
        newlyUnlocked.push({ ...badgeDef, unlocked_at: now });
      }
    };

    // 1. Check NIGHT_OWL Badge (Activity between 11 PM [23] and 4 AM [4])
    const currentHour = new Date().getHours();
    if (currentHour >= 23 || currentHour <= 4) {
      awardBadge(BADGE_DEFINITIONS.NIGHT_OWL);
    }

    // 2. Check SPEED_DEMON Badge (Reading velocity >= 80 PPH)
    const speedStats = db.prepare(`
      SELECT MAX(reading_speed_pph) as max_speed 
      FROM reading_progress 
      WHERE user_id = ?
    `).get(userId);
    if ((speedStats && speedStats.max_speed >= 80) || (currentContext.reading_speed_pph >= 80)) {
      awardBadge(BADGE_DEFINITIONS.SPEED_DEMON);
    }

    // 3. Check GENRE_EXPLORER Badge (Borrowed from >= 3 distinct categories)
    const categoryStats = db.prepare(`
      SELECT COUNT(DISTINCT b.category_id) as distinct_genres
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      WHERE br.user_id = ?
    `).get(userId);
    if (categoryStats && categoryStats.distinct_genres >= 3) {
      awardBadge(BADGE_DEFINITIONS.GENRE_EXPLORER);
    }

    // 4. Check AVID_READER Badge (>= 3 books returned successfully)
    const returnStats = db.prepare(`
      SELECT COUNT(*) as return_count
      FROM borrow_records
      WHERE user_id = ? AND status = 'RETURNED'
    `).get(userId);
    if (returnStats && returnStats.return_count >= 3) {
      awardBadge(BADGE_DEFINITIONS.AVID_READER);
    }

    // 5. Check STREAK_CHAMPION Badge (Streak >= 3 days)
    const streak = db.prepare('SELECT current_streak_days, longest_streak_days FROM reading_streaks WHERE user_id = ?').get(userId);
    if (streak && (streak.current_streak_days >= 3 || streak.longest_streak_days >= 3)) {
      awardBadge(BADGE_DEFINITIONS.STREAK_CHAMPION);
    }

    return newlyUnlocked;
  }

  /**
   * Retrieves all unlocked badges for a user.
   * 
   * @param {string} userId - Patron ID
   * @returns {Object} Unlocked and available badge summary
   */
  getUserBadges(userId) {
    const db = getDb();
    const unlocked = db.prepare(`
      SELECT badge_key, badge_name, badge_description, icon, unlocked_at
      FROM user_badges
      WHERE user_id = ?
      ORDER BY unlocked_at DESC
    `).all(userId);

    const unlockedKeys = new Set(unlocked.map(b => b.badge_key));
    const allBadges = Object.values(BADGE_DEFINITIONS).map(badge => ({
      ...badge,
      is_unlocked: unlockedKeys.has(badge.key),
      unlocked_at: unlocked.find(u => u.badge_key === badge.key)?.unlocked_at || null
    }));

    return {
      total_unlocked: unlocked.length,
      total_available: Object.keys(BADGE_DEFINITIONS).length,
      badges: allBadges
    };
  }

  /**
   * Retrieves current reading streak details for a user.
   * 
   * @param {string} userId - Patron ID
   * @returns {Object} Streak metrics and consistency level
   */
  getUserStreak(userId) {
    const db = getDb();
    const streak = db.prepare(`
      SELECT current_streak_days, longest_streak_days, last_activity_date, total_active_days, updated_at
      FROM reading_streaks
      WHERE user_id = ?
    `).get(userId);

    if (!streak) {
      return {
        current_streak_days: 0,
        longest_streak_days: 0,
        last_activity_date: null,
        total_active_days: 0,
        streak_status: 'INACTIVE',
        streak_tier: 'Novice Reader'
      };
    }

    let tier = 'Novice Reader';
    if (streak.current_streak_days >= 30) tier = 'Master Scholar';
    else if (streak.current_streak_days >= 14) tier = 'Dedicated Bookworm';
    else if (streak.current_streak_days >= 7) tier = 'Consistent Reader';
    else if (streak.current_streak_days >= 3) tier = 'Active Reader';

    return {
      ...streak,
      streak_status: streak.current_streak_days > 0 ? 'ACTIVE' : 'INACTIVE',
      streak_tier: tier
    };
  }
}

module.exports = new GamificationService();
