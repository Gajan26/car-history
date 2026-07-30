import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, Clock, Cog, Info, Shield, Wrench, ChevronDown, ChevronUp, CalendarRange, ShieldCheck, Check, XCircle, TrendingUp, CheckCircle } from 'lucide-react';
import { getMockData } from './mockData.js';

// Format ISO date to DD-MMM-YYYY (e.g., 10-FEB-2025)
const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

export default function App() {
  const [registration, setRegistration] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [expandedTest, setExpandedTest] = useState(null);

  // Cloned Car Check State
  const [v5cVin, setV5cVin] = useState('');
  const [vinCheckResult, setVinCheckResult] = useState(null); // 'matched', 'mismatched', or null

  // Dynamic favicon & tab title setup
  useEffect(() => {
    document.title = "Car Quality Check - Official MOT Analysis";

    // Inject Yellow Shield Favicon dynamically
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FFD300">
        <path d="M20.9 5.3c-.1-.6-.5-1.1-1.1-1.3l-7-2.6c-.5-.2-1-.2-1.5 0l-7 2.6c-.6.2-1 .7-1.1 1.3-.2 1.4-.2 3.1 0 4.7.4 3.7 2 7 4.9 9.5 1.1.9 2.5 1.5 3.9 1.5s2.8-.6 3.9-1.5c2.9-2.5 4.5-5.8 4.9-9.5.2-1.6.2-3.3 0-4.7z"/>
      </svg>
    `;
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.type = 'image/svg+xml';
    link.rel = 'icon';
    link.href = `data:image/svg+xml,${encodeURIComponent(svgIcon)}`;
    document.getElementsByTagName('head')[0].appendChild(link);
  }, []);

  const resetResultState = () => {
    setError(null);
    setWarning(null);
    setAnalysis(null);
    setIsUsingMockData(false);
    setV5cVin('');
    setVinCheckResult(null);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!registration) {
      setError('Please enter a Registration number.');
      return;
    }

    setLoading(true);
    resetResultState();

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('registration', registration);

      // Use env var for API base, fall back to relative path (works in prod)
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const url = `${apiBase}/mot?${queryParams.toString()}`;
      console.log('Calling API:', url);
      const response = await fetch(url);
      console.log('Response status:', response.status);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Backend not reachable or error occurred.');
        setLoading(false);
        return;
      }

      if (data.warning) setWarning(data.warning);

      const result = analyseVehicleHistory(Array.isArray(data) ? data[0] : data);
      setAnalysis(result);
      setLoading(false);
    } catch (err) {
      // Network-level failure (server unreachable, DNS, etc). Surface this
      // honestly instead of silently substituting mock data — a user acting
      // on a car-buying decision needs to know when they're NOT looking at
      // real DVSA data.
      console.error('MOT lookup failed:', err);
      setError('Unable to reach the service right now. Please try again shortly.');
      setLoading(false);
    }
  };

  const handleViewSample = () => {
    resetResultState();
    setIsUsingMockData(true);
    setAnalysis(analyseVehicleHistory(getMockData(registration || 'DEMO 123')));
  };

  const handleVinVerification = (e) => {
    e.preventDefault();
    if (!analysis || !analysis.vehicle) return;

    const inputCleaned = v5cVin.replace(/\s+/g, '').toUpperCase();
    const actualVin = (analysis.vehicle.vin || 'DEMOVIN1234567890').replace(/\s+/g, '').toUpperCase();

    if (inputCleaned === actualVin) {
      setVinCheckResult('matched');
    } else {
      setVinCheckResult('mismatched');
    }
  };

  const analyseVehicleHistory = (data) => {
    if (!data || !data.motTests || data.motTests.length === 0) {
      return { grade: 'N/A', score: 0, summary: 'No MOT history found.', penalties: [], timeline: [], vehicle: data || {} };
    }

    // Sort newest first
    const tests = [...data.motTests].sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));

    // Debug: Log all tests immediately after sorting
    console.log('DEBUG: All tests after sorting:');
    tests.forEach((t, i) => {
      console.log(`  [${i}] ${formatDate(t.completedDate)} - ${t.testResult} - ${t.defects.length} defects`);
      const majors = t.defects.filter(d => d.type === 'MAJOR' || d.type === 'DANGEROUS');
      if (majors.length > 0) {
        console.log(`      Majors: ${majors.map(m => m.text.substring(0, 50)).join(', ')}`);
      }
    });

    let score = 100;
    const penalties = [];
    const timeline = [];
    const advisoryHistory = {};

    // Check absolute latest MOT for unresolved critical failures
    const latestTest = tests[0];
    if (latestTest.testResult === 'FAILED') {
      const hasMajorDangerous = latestTest.defects.some(d => ['MAJOR', 'DANGEROUS'].includes(d.type));
      if (hasMajorDangerous) {
        return {
          grade: 'F',
          score: 0,
          summary: 'Critical Warning: Latest MOT failed with Major or Dangerous defects that are currently unresolved. Vehicle is likely unroadworthy.',
          penalties: [{ reason: 'Unresolved Major/Dangerous defects on latest MOT', points: -100, type: 'critical' }],
          timeline: [],
          vehicle: data,
          tests,
          hasRollback: false,
          maxAnnualMileage: 0
        };
      }
    }

    let lookbackWindowSize = 2; // Default lookback window size

    // Find the most recent FAILED test (if any)
    const mostRecentFailedIndex = tests.findIndex(t => t.testResult === 'FAILED');

    // If there's a FAILED test, expand lookback to include it
    if (mostRecentFailedIndex >= 0 && mostRecentFailedIndex > 1) {
      lookbackWindowSize = Math.max(lookbackWindowSize, mostRecentFailedIndex + 1);
    } else if (mostRecentFailedIndex === 1) {
      // First cycle check: Latest is PASS, previous is FAIL
      lookbackWindowSize = 5;
    }

    // Restrict active evaluation to the calculated lookback window
    const activeTests = tests.slice(0, lookbackWindowSize);
    console.log(`DEBUG: mostRecentFailedIndex=${mostRecentFailedIndex}, lookbackWindowSize=${lookbackWindowSize}, activeTests count=${activeTests.length}`);

    // Mileage anomaly tracking
    let hasRollback = false;
    let rollbackIntervals = [];
    let maxAnnualMileage = 0;
    let highestMileageInterval = '';

    activeTests.forEach((test, index) => {
      const testYear = new Date(test.completedDate).getFullYear();

      // Uniform Weighting Model across ALL defect severities
      let reportWeight = 0;
      if (index === 0 || index === 1) reportWeight = 1.0;
      else if (index === 2) reportWeight = 0.3;
      else if (index === 3) reportWeight = 0.2;
      else if (index === 4) reportWeight = 0.1;
      else reportWeight = 0.0;

      // Fail-Fix-Pass Tracking and Timeline logic
      if (test.testResult === 'FAILED') {
         const nextTest = tests[index - 1]; // chronologically later
         if (nextTest && nextTest.testResult === 'PASSED') {
           const daysBetween = (new Date(nextTest.completedDate) - new Date(test.completedDate)) / (1000 * 60 * 60 * 24);
           if (daysBetween > 0 && daysBetween <= 365) {
             const majorDefects = test.defects.filter(d => ['MAJOR', 'DANGEROUS'].includes(d.type));
             if (majorDefects.length > 0) {
                 timeline.push({
                   event: 'Resolved Maintenance Failure',
                   date: formatDate(nextTest.completedDate),
                   description: `Failed on ${formatDate(test.completedDate)} with ${majorDefects.length} major/dangerous issues, but was repaired and retested within ${Math.round(daysBetween)} days.`,
                   type: 'repair'
                 });
             }
           }
         }
      }

      // Chronological mileage checks
      const prevChronologicalTest = tests[index + 1];
      if (prevChronologicalTest && test.odometerValue && prevChronologicalTest.odometerValue) {
        const currOdo = parseInt(test.odometerValue, 10);
        const prevOdo = parseInt(prevChronologicalTest.odometerValue, 10);
        const milesDriven = currOdo - prevOdo;
        const currDate = new Date(test.completedDate);
        const prevDate = new Date(prevChronologicalTest.completedDate);
        const yearsDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24 * 365);

        // Odometer Rollback Detection
        if (milesDriven < 0) {
          hasRollback = true;
          rollbackIntervals.push({
            laterDate: test.completedDate,
            earlierDate: prevChronologicalTest.completedDate,
            droppedBy: Math.abs(milesDriven)
          });
        }

        // Excessive Mileage Check
        if (yearsDiff > 0.1 && milesDriven > 0) {
          const annualMileage = milesDriven / yearsDiff;
          if (annualMileage > maxAnnualMileage) {
            maxAnnualMileage = annualMileage;
            highestMileageInterval = `${prevDate.getFullYear()} - ${currDate.getFullYear()}`;
          }
        }
      }

      test.defects.forEach(defect => {
        const textKey = defect.text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
        const textLower = defect.text.toLowerCase();

        const brakeKeywords = ['brake', 'pad', 'disc', 'caliper'];
        const tyreKeywords = ['tyre', 'tire', 'tread'];
        const structuralKeywords = ['corrosion', 'rust', 'structural', 'welding', 'chassis'];
        const emissionsKeywords = ['exhaust', 'emissions', 'smoke', 'lambda', 'catalytic'];
        const oilKeywords = ['oil', 'leak', 'misting'];
        const steeringKeywords = ['steering', 'rack', 'alignment', 'track rod', 'column'];
        const seatbeltKeywords = ['seatbelt', 'seat belt', 'airbag', 'restraint'];
        const engineKeywords = ['engine', 'transmission', 'gearbox', 'valve', 'timing', 'mil', 'malfunction'];
        const wheelKeywords = ['wheel', 'bearing', 'stud', 'hub', 'rim'];
        const convenienceKeywords = ['bulb', 'washer', 'wiper', 'horn', 'reflector', 'license plate', 'door', 'window', 'glass', 'windscreen'];

        if (defect.type === 'ADVISORY' || defect.type === 'MINOR') {
          // Skip tyre wear from neglected advisory tracking (it's normal maintenance wear, not neglect)
          const isTyprWear = tyreKeywords.some(kw => textLower.includes(kw));
          if (!isTyprWear) {
            if (!advisoryHistory[textKey]) advisoryHistory[textKey] = { originalText: defect.text, testIndices: [] };
            if (!advisoryHistory[textKey].testIndices.includes(index)) {
              advisoryHistory[textKey].testIndices.push(index);
            }
          }

          let defectCategory = 'General Advisory/Minor';
          let baseAdvisoryPenalty = 2;

          if (seatbeltKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Seatbelt Advisory';
            baseAdvisoryPenalty = 6;
          } else if (steeringKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Steering Advisory';
            baseAdvisoryPenalty = 6;
          } else if (brakeKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Stopping Advisory';
            baseAdvisoryPenalty = 5;
          } else if (engineKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Engine / Transmission Advisory';
            baseAdvisoryPenalty = 5;
          } else if (structuralKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Structural Advisory';
            baseAdvisoryPenalty = 4;
          } else if (emissionsKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Emissions Advisory';
            baseAdvisoryPenalty = 4;
          } else if (oilKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Oil / Maintenance Advisory';
            baseAdvisoryPenalty = 4;
          } else if (wheelKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Wheel / Bearing Advisory';
            baseAdvisoryPenalty = 3;
          } else if (tyreKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Tyre Advisory';
            baseAdvisoryPenalty = 1;
          } else if (convenienceKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Convenience Advisory';
            baseAdvisoryPenalty = 1;
          }

          const advisoryPenalty = Math.round(baseAdvisoryPenalty * reportWeight);
          if (advisoryPenalty > 0) {
            score -= advisoryPenalty;
            penalties.push({
              reason: `${defect.type} [${defectCategory}]: ${defect.text} (${testYear})`,
              points: -advisoryPenalty,
              type: 'advisory_defect'
            });
          }

        } else if ((defect.type === 'MAJOR' || defect.type === 'DANGEROUS') && test.testResult === 'FAILED') {
          let defectCategory = 'General Major Defect';
          let basePenalty = 10;

          if (seatbeltKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Seatbelt Defect';
            basePenalty = 10;
          } else if (steeringKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Steering Defect';
            basePenalty = 10;
          } else if (brakeKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Safety / Stopping Defect';
            basePenalty = 9;
          } else if (engineKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Engine / Transmission Defect';
            basePenalty = 8;
          } else if (tyreKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Tyre Defect';
            basePenalty = 8;
          } else if (structuralKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Structural Defect';
            basePenalty = 7;
          } else if (emissionsKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Emissions Defect';
            basePenalty = 6;
          } else if (oilKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Oil / Maintenance Defect';
            basePenalty = 5;
          } else if (wheelKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Wheel / Bearing Defect';
            basePenalty = 6;
          } else if (convenienceKeywords.some(kw => textLower.includes(kw))) {
            defectCategory = 'Convenience Defect';
            basePenalty = 2;
          }

          // Fail-fix grace: if this failed test is followed by a pass within 30 days, reduce penalty by 50%
          // Delayed repair penalty: if it takes >30 days to fix, apply an additional penalty
          let failFixGrace = 1.0;
          let delayedRepairPenalty = 0;
          if (index > 0) {
            const nextTest = tests[index - 1]; // chronologically later (more recent)
            if (nextTest && nextTest.testResult === 'PASSED') {
              const daysBetween = (new Date(nextTest.completedDate) - new Date(test.completedDate)) / (1000 * 60 * 60 * 24);
              if (daysBetween > 0 && daysBetween <= 30) {
                failFixGrace = 0.5; // Reduce penalty if quickly resolved
              } else if (daysBetween > 30) {
                // Apply delayed repair penalty based on how long it took to fix
                if (daysBetween <= 90) {
                  delayedRepairPenalty = 8; // Minor delay (30-90 days)
                } else if (daysBetween <= 365) {
                  delayedRepairPenalty = 15; // Significant delay (3-12 months)
                } else {
                  delayedRepairPenalty = 20; // Extensive delay (1+ year)
                }
              }
            }
          }

          const defectPenalty = Math.round(basePenalty * reportWeight * failFixGrace);
          score -= defectPenalty;
          penalties.push({
            reason: `${defect.type} [${defectCategory}]: ${defect.text} (${testYear})`,
            points: -defectPenalty,
            type: 'major_defect'
          });

          // Apply delayed repair penalty if applicable
          if (delayedRepairPenalty > 0) {
            const daysBetween = (new Date(tests[index - 1].completedDate) - new Date(test.completedDate)) / (1000 * 60 * 60 * 24);
            const delayLabel = daysBetween > 365 ? '1+ year' : daysBetween > 90 ? '3-12 months' : '30-90 days';
            score -= delayedRepairPenalty;
            penalties.push({
              reason: `Delayed Major Repair (${delayLabel} to resolve): ${defect.text}`,
              points: -delayedRepairPenalty,
              type: 'delayed_repair'
            });
          }
        }
      });
    });

    for (let i = 0; i < tests.length - 1; i++) {
      const newerTest = tests[i];
      const olderTest = tests[i + 1];
      const newerDate = new Date(newerTest.completedDate);
      const olderDate = new Date(olderTest.completedDate);

      // Calculate expected next test date (12 months after older test)
      const expectedNextDate = new Date(olderDate);
      expectedNextDate.setMonth(expectedNextDate.getMonth() + 12);

      // Calculate excess gap beyond the 12-month interval
      const excessGapInMs = newerDate - expectedNextDate;
      const excessGapInMonths = excessGapInMs / (1000 * 60 * 60 * 24 * 30.44);

      if (excessGapInMonths > 0.5) {
        timeline.push({
          event: 'MOT Timeline Gap',
          date: `${formatDate(olderDate)} to ${formatDate(newerDate)}`,
          description: `${Math.round(excessGapInMonths)} months SORN or kept off-road (beyond the standard 12-month MOT interval).`,
          type: 'gap'
        });
      }
    }

    for (const details of Object.values(advisoryHistory)) {
      if (details.testIndices.length > 1) {
        details.testIndices.sort((a, b) => a - b);
        let maxConsecutive = 1;
        let currentConsecutive = 1;

        for (let i = 0; i < details.testIndices.length - 1; i++) {
          if (details.testIndices[i + 1] - details.testIndices[i] === 1) {
            currentConsecutive++;
            if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
          } else {
            currentConsecutive = 1;
          }
        }

        if (maxConsecutive > 1) {
          const isCurrentIssue = details.testIndices.includes(0);
          const repeatedPenaltyWeight = isCurrentIssue ? 1.0 : 0.4;

          let penalty = Math.round(2.5 * maxConsecutive * repeatedPenaltyWeight);
          penalty = Math.min(penalty, 15); // Cap at 15 points max
          score -= penalty;
          penalties.push({
            reason: `Neglected Advisory (${maxConsecutive} consecutive tests): ${details.originalText}`,
            points: -penalty,
            type: 'neglected_advisory'
          });
        }
      }
    }

    // Multiple issue categories penalty: car with 3+ different defect categories is unreliable
    const issueCategoriesInActiveTests = new Set();
    activeTests.forEach(test => {
      test.defects.forEach(defect => {
        const textLower = defect.text.toLowerCase();
        let category = 'general';

        if (['seatbelt', 'seat belt', 'airbag', 'restraint'].some(kw => textLower.includes(kw))) category = 'seatbelt';
        else if (['steering', 'rack', 'alignment', 'track rod', 'column'].some(kw => textLower.includes(kw))) category = 'steering';
        else if (['brake', 'pad', 'disc', 'caliper'].some(kw => textLower.includes(kw))) category = 'brakes';
        else if (['engine', 'transmission', 'gearbox', 'valve', 'timing', 'mil'].some(kw => textLower.includes(kw))) category = 'engine';
        else if (['tyre', 'tire', 'tread'].some(kw => textLower.includes(kw))) category = 'tyres';
        else if (['exhaust', 'emissions', 'smoke', 'lambda', 'catalytic'].some(kw => textLower.includes(kw))) category = 'emissions';
        else if (['oil', 'leak', 'misting'].some(kw => textLower.includes(kw))) category = 'oil';
        else if (['corrosion', 'rust', 'structural', 'welding', 'chassis'].some(kw => textLower.includes(kw))) category = 'structural';
        else if (['suspension', 'spring', 'bush', 'arm', 'link'].some(kw => textLower.includes(kw))) category = 'suspension';
        else if (['wheel', 'bearing', 'stud', 'hub', 'rim'].some(kw => textLower.includes(kw))) category = 'wheels';
        else if (['headlamp', 'lamp', 'light', 'beam'].some(kw => textLower.includes(kw))) category = 'lighting';
        else if (['wiper', 'washer', 'mirror', 'horn', 'reflector', 'door', 'window', 'glass', 'windscreen'].some(kw => textLower.includes(kw))) category = 'convenience';

        issueCategoriesInActiveTests.add(category);
      });
    });

    if (issueCategoriesInActiveTests.size >= 3) {
      const multiIssuePenalty = 10;
      score -= multiIssuePenalty;
      penalties.push({
        reason: `Multiple Issue Categories: ${Array.from(issueCategoriesInActiveTests).join(', ')} (${issueCategoriesInActiveTests.size} categories indicates poor maintenance)`,
        points: -multiIssuePenalty,
        type: 'multiple_issues'
      });
    }

    score = Math.max(0, Math.min(100, score));

    // Debug logging
    console.log('=== SCORING DEBUG ===');
    console.log('Total tests received:', tests.length);
    console.log('Tests:', tests.map(t => `${formatDate(t.completedDate)} (${t.testResult}) - ${t.defects.length} defects`));
    console.log('Final score:', score);
    console.log('Total penalties:', penalties.length);
    console.log('Penalties breakdown:');
    penalties.forEach(p => console.log(`  ${p.type}: ${p.points} - ${p.reason}`));

    let grade = 'A';
    if (score >= 85) grade = 'A';
    else if (score >= 72) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';
    else if (score >= 40) grade = 'E';
    else grade = 'F';

    let summary = '';
    if (hasRollback) {
      summary = 'Mileage discrepancy between tests. Odometer rollback suspected.';
    } else {
      if (grade === 'A') summary = 'Excellent maintenance history. Very clean record with prompt attention to issues.';
      if (grade === 'B' || grade === 'C') summary = 'Good maintenance profile overall, but marked down slightly for minor repeat advisories or recent defects.';
      if (grade === 'D' || grade === 'E') summary = 'Attention needed. History shows repeat unresolved advisories or multiple test cycles with failures.';
      if (grade === 'F') summary = 'Critical maintenance issues detected. Vehicle has major failures or poor record management.';
    }

    return { grade, score, summary, penalties, timeline, vehicle: data, tests, hasRollback, rollbackIntervals, maxAnnualMileage, highestMileageInterval };
  };

  const getGradeColors = (grade) => {
    switch (grade) {
      case 'A': return 'text-green-400 bg-green-950/40 border-green-500/30';
      case 'B': return 'text-lime-400 bg-lime-950/40 border-lime-500/30';
      case 'C': return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/30';
      case 'D': return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
      case 'E': return 'text-red-400 bg-red-950/40 border-red-500/30';
      case 'F': return 'text-red-500 bg-red-950/60 border-red-500/50';
      default: return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  const renderOdometerChart = (testsList) => {
    const chartData = [...testsList]
      .filter(t => t.odometerValue && !isNaN(parseInt(t.odometerValue, 10)))
      .sort((a, b) => new Date(a.completedDate) - new Date(b.completedDate));

    if (chartData.length < 2) {
      return (
        <div className="h-32 flex items-center justify-center text-slate-500 text-sm border border-slate-800/60 rounded-xl bg-slate-900/30">
          Insufficient chronological data to generate trend graph.
        </div>
      );
    }

    const times = chartData.map(d => new Date(d.completedDate).getTime());
    const odos = chartData.map(d => parseInt(d.odometerValue, 10));

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1;

    const minOdo = Math.min(...odos);
    const maxOdo = Math.max(...odos);
    const odoRange = maxOdo - minOdo || 1;

    const svgWidth = 500;
    const svgHeight = 160;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const graphHeight = svgHeight - paddingTop - paddingBottom;

    const points = chartData.map(d => {
      const t = new Date(d.completedDate).getTime();
      const val = parseInt(d.odometerValue, 10);
      const x = paddingLeft + ((t - minTime) / timeRange) * graphWidth;
      const y = paddingTop + graphHeight - ((val - minOdo) / odoRange) * graphHeight;
      return { x, y, val, date: d.completedDate, year: new Date(d.completedDate).getFullYear() };
    });

    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/40">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Historical Mileage Trend Curve
          </span>
          <span className="text-[10px] text-slate-500">Min: {minOdo.toLocaleString()} mi • Max: {maxOdo.toLocaleString()} mi</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto text-slate-400">
          <line x1={paddingLeft} y1={paddingTop} x2={svgWidth - paddingRight} y2={paddingTop} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={paddingLeft} y1={paddingTop + graphHeight / 2} x2={svgWidth - paddingRight} y2={paddingTop + graphHeight / 2} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={paddingLeft} y1={paddingTop + graphHeight} x2={svgWidth - paddingRight} y2={paddingTop + graphHeight} stroke="#1e293b" />

          <path d={linePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, idx) => {
            const isDiscrepancy = idx > 0 && points[idx].val < points[idx - 1].val;
            return (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isDiscrepancy ? "5" : "4"}
                  className={isDiscrepancy ? "fill-red-500 stroke-slate-950 stroke-2 animate-pulse" : "fill-cyan-400 stroke-slate-950 stroke-2"}
                />

                <text x={p.x} y={svgHeight - 8} fontSize="9" fontWeight="600" textAnchor="middle" className="fill-slate-500 font-sans">
                  {p.year}
                </text>

                {(idx === 0 || idx === points.length - 1 || isDiscrepancy) && (
                  <text x={p.x} y={p.y - 10} fontSize="8" fontWeight="bold" textAnchor="middle" className="fill-slate-300 font-mono">
                    {Math.round(p.val / 1000)}k
                  </text>
                )}
              </g>
            );
          })}

          <text x={paddingLeft - 8} y={paddingTop + 4} fontSize="9" textAnchor="end" className="fill-slate-500 font-mono">{Math.round(maxOdo / 1000)}k</text>
          <text x={paddingLeft - 8} y={paddingTop + graphHeight / 2 + 3} fontSize="9" textAnchor="end" className="fill-slate-500 font-mono">{Math.round((minOdo + maxOdo) / 2 / 1000)}k</text>
          <text x={paddingLeft - 8} y={paddingTop + graphHeight + 3} fontSize="9" textAnchor="end" className="fill-slate-500 font-mono">{Math.round(minOdo / 1000)}k</text>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      <style>{`
        #root {
          max-width: 100% !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body {
          background-color: #020617 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      <header className="bg-slate-900 border-b border-slate-800 py-10 px-4 shadow-xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div />
            <a href="https://forms.gle/LKN4CjzwWY1KW6Kf7" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300 text-sm font-semibold underline transition-colors">
              Provide Feedback
            </a>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-extrabold mb-2 flex items-center justify-center gap-2 tracking-tight text-white">
              <Shield className="w-9 h-9 text-yellow-400 fill-yellow-400/20" />
              Car Quality Check
            </h1>
            <p className="text-slate-400 mb-8 text-sm md:text-base">Official Vehicle MOT Analysis and History Check</p>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto items-center justify-center">
            <div className="relative flex items-center bg-[#FFD300] text-black font-bold text-xl rounded-xl shadow-lg overflow-hidden border-2 border-yellow-500 h-14 w-full md:w-80">
              <div className="bg-blue-800 text-white flex flex-col justify-center items-center px-3.5 h-full select-none">
                <Shield className="w-5 h-5 text-yellow-400 fill-yellow-400/20" />
              </div>
              <input
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                placeholder="ENTER REG"
                className="bg-transparent text-black placeholder-yellow-800/50 font-extrabold text-2xl uppercase tracking-wider focus:outline-none px-4 w-full text-center"
                maxLength={10}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto h-14 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold px-8 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md disabled:bg-slate-800 disabled:text-slate-500"
            >
              {loading ? <Cog className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
              <span>Start Diagnosis</span>
            </button>
          </form>

          {error && (
            <div className="mt-6 max-w-xl mx-auto bg-red-950/50 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 text-left">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div className="text-sm font-semibold flex-1">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleViewSample}
                  className="mt-2 text-xs font-bold underline decoration-red-500/50 hover:decoration-red-400 text-red-300"
                >
                  View a sample report instead
                </button>
              </div>
            </div>
          )}
          {warning && (
            <div className="mt-4 max-w-xl mx-auto bg-yellow-950/50 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-xl flex items-start gap-3 text-left">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-yellow-500" />
              <span className="text-sm font-semibold">{warning}</span>
            </div>
          )}
          {isUsingMockData && !error && (
            <div className="text-yellow-400 text-xs mt-4 flex items-center justify-center gap-1.5 opacity-80">
              <AlertTriangle className="w-4 h-4"/> Sample data shown
            </div>
          )}
          </div>

          {!analysis && (
            <div className="mt-12 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-8 text-center">Why Use Car Quality Check?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Detect Odometer Fraud
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Catches mileage rollback instantly. Know if the miles are real before you commit.</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Uncover Hidden Repairs
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Spot chronic issues. Chronic engine oil leaks? Brake problems? We'll find the patterns.</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Cloned Car Check
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Enter the VIN from the V5C logbook to verify the vehicle's authentic identity and catch potential clones.</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Know Before You Drive
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Full MOT history and chronological analysis reveals the car's real story in seconds.</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Official MOT Records
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Data direct from the government. The same source MOT garages use.</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
                  <h3 className="font-bold text-green-400 mb-4 flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Instant Grading (A–F)
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">Simple scoring system cuts through jargon. Know the condition immediately.</p>
                </div>

              </div>
            </div>
          )}
        </div>
      </header>

      {analysis && !error && (
        <main className="max-w-6xl mx-auto mt-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">

          <div className="space-y-8 lg:col-span-1">

            <div className={`rounded-2xl p-8 text-center border shadow-xl transition-all ${getGradeColors(analysis.grade)}`}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-100 mb-2">Diagnostic Grade</h2>
              <div className="text-8xl font-black mb-1">{analysis.grade}</div>

              <div className="inline-block mt-1 mb-4 px-3 py-1 bg-slate-950/60 border border-slate-800/40 text-slate-300 font-mono text-xs rounded-full">
                Calculated Index Score: <span className="text-yellow-400 font-bold">{analysis.score}</span> / 100
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-medium">{analysis.summary}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2 border-b border-slate-800 pb-3 text-white">
                <Info className="w-4 h-4 text-slate-400" /> Technical Registration Data
              </h3>
              <ul className="space-y-3.5 text-sm">
                <li className="flex justify-between"><span className="text-slate-400">Registration</span> <span className="font-semibold text-white tracking-wide">{analysis.vehicle.registration || 'Unknown'}</span></li>
                <li className="flex justify-between"><span className="text-slate-400">Make</span> <span className="font-semibold text-white">{analysis.vehicle.make || 'Unknown'}</span></li>
                <li className="flex justify-between"><span className="text-slate-400">Model</span> <span className="font-semibold text-white">{analysis.vehicle.model || 'Unknown'}</span></li>
                <li className="flex justify-between"><span className="text-slate-400">First Registered</span> <span className="font-semibold text-white">{analysis.vehicle.firstUsedDate || 'Unknown'}</span></li>
                <li className="flex justify-between"><span className="text-slate-400">Colour Specification</span> <span className="font-semibold text-white">{analysis.vehicle.primaryColour || 'Unknown'}</span></li>
              </ul>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-base mb-2 flex items-center gap-2 text-white">
                <ShieldCheck className="w-5 h-5 text-yellow-400" /> Cloned car check
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Enter the vehicle's 17-digit Chassis Number (VIN), found in the V5C logbook, at the bottom of the windshield, or on the door pillar, to cross-reference its authenticity.
              </p>

              <form onSubmit={handleVinVerification} className="space-y-3">
                <input
                  type="text"
                  value={v5cVin}
                  onChange={(e) => {
                    setV5cVin(e.target.value.toUpperCase());
                    setVinCheckResult(null);
                  }}
                  placeholder="ENTER 17-DIGIT CHASSIS VIN"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-sm uppercase tracking-wider text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 text-center"
                  maxLength={17}
                />
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 transition-colors py-2 rounded-xl text-xs font-bold text-slate-200"
                >
                  Verify Verification Matching
                </button>
              </form>

              {vinCheckResult === 'matched' && (
                <div className="mt-4 p-3.5 bg-green-950/40 border border-green-500/30 text-green-400 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 shrink-0 text-green-500" />
                  <span>Chassis Verification Successful: Odometer record maps cleanly to vehicle frame identity.</span>
                </div>
              )}
              {vinCheckResult === 'mismatched' && (
                <div className="mt-4 p-3.5 bg-red-950/40 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-start gap-2 font-semibold">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>Cloned Car Warning! Entered Chassis Number does not correspond to the registration mark.</span>
                </div>
              )}
            </div>

          </div>

          <div className="space-y-8 lg:col-span-2">

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-base mb-5 flex items-center gap-2 border-b border-slate-800 pb-3 text-white">
                <Wrench className="w-4 h-4 text-yellow-400" /> Maintenance & Timeline History
              </h3>
              {analysis.timeline.length === 0 ? (
                <div className="bg-slate-950/40 text-slate-400 p-4 rounded-xl border border-slate-800/60 text-sm">
                  No historical maintenance failures, anomalies, or test chronological gaps found. This indicates stable reporting intervals.
                </div>
              ) : (
                <div className="border-l-2 border-slate-800 ml-3 pl-5 space-y-5">
                  {analysis.timeline.map((event, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[29px] top-1 w-4.5 h-4.5 rounded-full border-4 border-slate-950 shadow ${
                        event.type === 'gap' ? 'bg-slate-600' : 'bg-yellow-400'
                      }`}></div>
                      <p className="text-[10px] font-bold text-slate-500 mb-0.5">{event.date}</p>
                      <p className={`text-sm font-semibold flex items-center gap-1.5 ${
                        event.type === 'gap' ? 'text-slate-400' : 'text-white'
                      }`}>
                        {event.type === 'gap' && <CalendarRange className="w-4 h-4 text-slate-500" />}
                        {event.event}
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-1">{event.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2 border-b border-slate-800 pb-3 text-white">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Mileage & Odometer Insights
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-start gap-3">
                  {analysis.hasRollback ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-1.5 animate-pulse" />
                      <div>
                        <div className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Rollback Detected
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Mileage decreased by <span className="font-bold text-red-400">{analysis.rollbackIntervals[0]?.droppedBy.toLocaleString()} mi</span> between {analysis.rollbackIntervals[0]?.earlierDate.split('-')[0]} and {analysis.rollbackIntervals[0]?.laterDate.split('-')[0]}. Suspected fraud.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-green-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="text-green-400 text-xs font-bold uppercase tracking-wider">
                          Chronology Consistent
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          No mileage rollback detected. Odometer values increase sequentially on all chronological tests.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 flex items-start gap-3">
                  {analysis.maxAnnualMileage > 10000 ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="flex items-center gap-1 text-yellow-400 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> High Usage Warning
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Usage peaked at <span className="font-bold text-yellow-400">{Math.round(analysis.maxAnnualMileage).toLocaleString()} mi/yr</span> during {analysis.highestMileageInterval}. Travels more than 10,000 miles/yr.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-green-500 shrink-0 mt-1.5" />
                      <div>
                        <div className="text-green-400 text-xs font-bold uppercase tracking-wider">
                          Moderate Usage Profile
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Car consistently travels less than 10,000 miles in a single year across all evaluation periods.
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {renderOdometerChart(analysis.tests)}

            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
               <h3 className="font-bold text-base p-6 border-b border-slate-800 flex items-center gap-2 text-white">
                <Clock className="w-4 h-4 text-slate-400" /> Complete MOT Testing History
              </h3>
              <div className="divide-y divide-slate-800/60">
                {analysis.tests.map((test, idx) => {
                   const isExpanded = expandedTest === idx;
                   const isPass = test.testResult === 'PASSED';

                   const nextTest = analysis.tests[idx + 1];
                   let gapMessage = null;
                   if (nextTest) {
                     const currentTestDate = new Date(test.completedDate);
                     const previousTestDate = new Date(nextTest.completedDate);
                     // Calculate expected next test date (12 months after previous)
                     const expectedNextDate = new Date(previousTestDate);
                     expectedNextDate.setMonth(expectedNextDate.getMonth() + 12);
                     // Calculate excess gap beyond the 12-month interval
                     const excessGapInMs = currentTestDate - expectedNextDate;
                     const excessGapInMonths = excessGapInMs / (1000 * 60 * 60 * 24 * 30.44);
                     if (excessGapInMonths > 0.5) {
                       gapMessage = `${Math.round(excessGapInMonths)} months SORN or kept off-road`;
                     }
                   }

                   return (
                    <div key={idx} className="bg-transparent">
                      <button
                        onClick={() => setExpandedTest(isExpanded ? null : idx)}
                        className="w-full flex items-center justify-between p-5 hover:bg-slate-900/40 transition-colors text-left"
                      >
                        <div>
                          <p className="font-bold text-base text-white">{formatDate(test.completedDate)}</p>
                          <p className="text-sm text-slate-400 mt-0.5">{test.odometerValue ? `${parseInt(test.odometerValue, 10).toLocaleString()} ${test.odometerUnit}` : 'Odometer Not Stated'}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
                            isPass ? 'bg-green-950/60 text-green-400 border border-green-500/20' : 'bg-red-950/60 text-red-400 border border-red-500/20'
                          }`}>
                            {test.testResult}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500"/> : <ChevronDown className="w-4 h-4 text-slate-500"/>}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-1 bg-slate-950/40 text-sm">
                          {test.defects.length === 0 ? (
                            <p className="text-slate-500 italic">Excellent test sheet: No faults, advisories, or warnings listed.</p>
                          ) : (
                            <ul className="space-y-2.5">
                              {test.defects.map((def, didx) => (
                                <li key={didx} className="flex gap-2.5 items-start">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wider shrink-0 mt-0.5 ${
                                    def.type === 'ADVISORY' ? 'bg-yellow-950 text-yellow-400 border border-yellow-500/10' :
                                    def.type === 'MINOR' ? 'bg-orange-950 text-orange-400 border border-orange-500/10' :
                                    'bg-red-950 text-red-400 border border-red-500/10'
                                  }`}>
                                    {def.type}
                                  </span>
                                  <span className="text-slate-300 leading-relaxed font-medium">{def.text}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {gapMessage && (
                        <div className="bg-slate-950 px-5 py-2 border-y border-slate-800/60 flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <CalendarRange className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span>{gapMessage}</span>
                        </div>
                      )}
                    </div>
                   )
                })}
              </div>
            </div>

          </div>
        </main>
      )}
    </div>
  );
}
