export function GridOverlay() {
  const cellLabels = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16]
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '816px',
        height: '1056px',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {[0, 25, 50, 75, 100].map((percent) => (
        <div key={`major-${percent}`}>
          <div
            style={{
              position: 'absolute',
              left: `${percent}%`,
              top: 0,
              width: '2px',
              height: '100%',
              backgroundColor: 'rgba(0, 180, 216, 0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: `${percent}%`,
              left: 0,
              height: '2px',
              width: '100%',
              backgroundColor: 'rgba(0, 180, 216, 0.7)',
            }}
          />
        </div>
      ))}

      {Array.from({ length: 40 }, (_, i) => i * 2.5).map((percent) => (
        percent % 25 !== 0 && (
          <div key={`minor-${percent}`}>
            <div
              style={{
                position: 'absolute',
                left: `${percent}%`,
                top: 0,
                width: '1px',
                height: '100%',
                backgroundColor: 'rgba(0, 180, 216, 0.25)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: `${percent}%`,
                left: 0,
                height: '1px',
                width: '100%',
                backgroundColor: 'rgba(0, 180, 216, 0.25)',
              }}
            />
          </div>
        )
      ))}

      {cellLabels.map((row, rowIndex) =>
        row.map((cellNum, colIndex) => (
          <div
            key={`label-${cellNum}`}
            style={{
              position: 'absolute',
              left: `${colIndex * 25 + 12.5}%`,
              top: `${rowIndex * 25 + 12.5}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'rgba(0, 180, 216, 0.5)',
            }}
          >
            {cellNum}
          </div>
        ))
      )}
    </div>
  );
}
