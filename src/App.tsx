import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import FeedingScreen from './screens/Feeding/FeedingScreen';
import DiaperScreen from './screens/Diaper/DiaperScreen';
import SleepScreen from './screens/Sleep/SleepScreen';
import DiversificationScreen from './screens/Diversification/DiversificationScreen';
import HealthScreen from './screens/Growth/HealthScreen';
import OnboardingScreen from './screens/Onboarding/OnboardingScreen';

function App() {
  // TODO: Check if user has completed onboarding
  const hasCompletedOnboarding = true;

  return (
    <Router>
      <Routes>
        {!hasCompletedOnboarding && (
          <Route path="/onboarding" element={<OnboardingScreen />} />
        )}

        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/feeding" replace />} />
          <Route path="feeding" element={<FeedingScreen />} />
          <Route path="diaper" element={<DiaperScreen />} />
          <Route path="sleep" element={<SleepScreen />} />
          <Route path="diversification" element={<DiversificationScreen />} />
          <Route path="health" element={<HealthScreen />} />
        </Route>

        {/* Redirect to onboarding or home based on status */}
        <Route
          path="*"
          element={<Navigate to={hasCompletedOnboarding ? "/" : "/onboarding"} replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
