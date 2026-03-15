import { FlightDealApp } from "@/components/flight-deal-app";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <FlightDealApp />
      </div>
    </main>
  );
}
