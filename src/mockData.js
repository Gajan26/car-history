// Sample data for the explicit "View sample report" demo path. Only ever
// shown when the user asks for it — never as a silent fallback for a failed
// real lookup (see App.jsx).
export function getMockData(reg) {
  const regClean = (reg || '').replace(/\s+/g, '').toUpperCase();

  if (regClean === 'ROLLBACK') {
    return {
      registration: 'ROLLBACK',
      make: 'PEUGEOT',
      model: '3008',
      firstUsedDate: '2016-09-14',
      fuelType: 'Diesel',
      primaryColour: 'Black',
      vin: 'DEMOVIN1234567890',
      motTests: [
        { completedDate: '2023-09-10', testResult: 'PASSED', odometerValue: '35000', odometerUnit: 'mi', defects: [] },
        { completedDate: '2021-09-15', testResult: 'PASSED', odometerValue: '52100', odometerUnit: 'mi', defects: [] },
        { completedDate: '2020-09-11', testResult: 'PASSED', odometerValue: '45890', odometerUnit: 'mi', defects: [] }
      ]
    };
  }

  if (regClean === 'HIGHMILE') {
    return {
      registration: 'HIGHMILE',
      make: 'TOYOTA',
      model: 'PRIUS',
      firstUsedDate: '2018-02-11',
      fuelType: 'Hybrid',
      primaryColour: 'Silver',
      vin: 'DEMOVIN1234567890',
      motTests: [
        { completedDate: '2023-02-10', testResult: 'PASSED', odometerValue: '85000', odometerUnit: 'mi', defects: [] },
        { completedDate: '2021-02-15', testResult: 'PASSED', odometerValue: '45000', odometerUnit: 'mi', defects: [] },
        { completedDate: '2020-02-11', testResult: 'PASSED', odometerValue: '22000', odometerUnit: 'mi', defects: [] }
      ]
    };
  }

  return {
    registration: reg || 'DEMO 123',
    make: 'FORD',
    model: 'FIESTA',
    firstUsedDate: '2015-05-12',
    fuelType: 'Petrol',
    primaryColour: 'Blue',
    vin: 'DEMOVIN1234567890',
    motTests: [
      {
        completedDate: '2023-05-10',
        testResult: 'PASSED',
        odometerValue: '68430',
        odometerUnit: 'mi',
        defects: [
          { type: 'ADVISORY', text: 'Offside Front Tyre worn close to legal limit/worn on edge' },
          { type: 'ADVISORY', text: 'Rear brake pads wearing thin' }
        ]
      },
      {
        completedDate: '2021-05-15',
        testResult: 'PASSED',
        odometerValue: '52100',
        odometerUnit: 'mi',
        defects: [{ type: 'ADVISORY', text: 'Offside Front Tyre worn close to legal limit' }]
      },
      {
        completedDate: '2020-05-11',
        testResult: 'PASSED',
        odometerValue: '45890',
        odometerUnit: 'mi',
        defects: [
          { type: 'ADVISORY', text: 'Offside Front Tyre worn close to legal limit' },
          { type: 'ADVISORY', text: 'Slight corrosion on exhaust' }
        ]
      },
      {
        completedDate: '2019-05-10',
        testResult: 'PASSED',
        odometerValue: '39010',
        odometerUnit: 'mi',
        defects: []
      },
      {
        completedDate: '2019-05-08',
        testResult: 'FAILED',
        odometerValue: '39010',
        odometerUnit: 'mi',
        defects: [
          { type: 'MAJOR', text: 'Nearside Front Brake pad(s) less than 1.5 mm thick' },
          { type: 'MAJOR', text: 'Offside Headlamp aim too low' }
        ]
      }
    ]
  };
}
