import { useMemo, useState } from "react";
import { localDateKey, type DailyScore } from "../../../domain/analytics/daily-score-calendar.ts";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const MONTH_FORMATTER = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" });
const SCORE_FORMATTER = new Intl.NumberFormat("ja-JP");
const COMPACT_SCORE_FORMATTER = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

type HistoryCalendarProps = {
  dailyScores: ReadonlyArray<DailyScore>;
  visibleMonth: Date;
  selectedDateKey: string | null;
  onChangeMonth: (month: Date) => void;
  onSelectDate: (dateKey: string | null) => void;
};

export function HistoryCalendar({
  dailyScores,
  visibleMonth,
  selectedDateKey,
  onChangeMonth,
  onSelectDate,
}: HistoryCalendarProps) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const [todayKey] = useState(() => localDateKey(Date.now()));
  const scoresByDate = useMemo(
    () =>
      new Map(
        dailyScores
          .filter((score) => score.dateKey.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
          .map((score) => [score.dateKey, score]),
      ),
    [dailyScores, month, year],
  );
  const leadingDays = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / WEEKDAYS.length) * WEEKDAYS.length;

  const moveMonth = (offset: number) => {
    onChangeMonth(new Date(year, month + offset, 1));
    onSelectDate(null);
  };

  return (
    <section className="history-calendar" aria-labelledby="history-calendar-title">
      <header className="history-calendar__heading">
        <div>
          <span className="section-index">DAILY SCORE</span>
          <h2 id="history-calendar-title">日々のスコア</h2>
          <p>各日の最高スコアを表示します。日付を選ぶと、その日の練習だけを確認できます。</p>
        </div>
        <div className="history-calendar__navigation" aria-label="表示する月">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="前の月">
            ←
          </button>
          <strong aria-live="polite">{MONTH_FORMATTER.format(visibleMonth)}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="次の月">
            →
          </button>
          <button
            className="history-calendar__today"
            type="button"
            onClick={() => {
              const today = new Date();
              onChangeMonth(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(null);
            }}
          >
            今月へ
          </button>
        </div>
      </header>

      <div className="history-calendar__grid" aria-label={`${MONTH_FORMATTER.format(visibleMonth)}のスコア`}>
        {WEEKDAYS.map((weekday) => (
          <span className="history-calendar__weekday" aria-hidden="true" key={weekday}>
            {weekday}
          </span>
        ))}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - leadingDays + 1;
          if (day < 1 || day > daysInMonth) {
            return (
              <span className="history-calendar__day history-calendar__day--empty" aria-hidden="true" key={index} />
            );
          }
          const dateKey = localDateKey(new Date(year, month, day).getTime()) as string;
          const dailyScore = scoresByDate.get(dateKey);
          const isSelected = selectedDateKey === dateKey;
          const label = dailyScore
            ? `${month + 1}月${day}日 最高スコア ${SCORE_FORMATTER.format(dailyScore.bestScore)} ${dailyScore.sessionCount}回`
            : `${month + 1}月${day}日 記録なし`;

          return (
            <button
              className="history-calendar__day"
              data-today={dateKey === todayKey || undefined}
              data-has-score={Boolean(dailyScore) || undefined}
              aria-label={label}
              aria-pressed={isSelected}
              disabled={!dailyScore}
              type="button"
              key={dateKey}
              onClick={() => onSelectDate(isSelected ? null : dateKey)}
            >
              <span>{day}</span>
              {dailyScore ? (
                <strong>
                  {COMPACT_SCORE_FORMATTER.format(dailyScore.bestScore)}
                  <small>{dailyScore.sessionCount}回</small>
                </strong>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
