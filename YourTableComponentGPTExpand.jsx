________________________________________________________________________________
const handleExpandChange = async (updaterOrValue) => {
  let newExpanded;
  if (typeof updaterOrValue === 'function') {
    newExpanded = updaterOrValue(manualExpanded);
  } else {
    newExpanded = updaterOrValue;
  }

  setManualExpanded(newExpanded);

  // Instead of fetching based on rowId -> loop over tableData
  for (const [rowId, isExpanded] of Object.entries(newExpanded)) {
    if (isExpanded) {
      // Find the subRow manually from tableData
      const findSubRow = (rows) => {
        for (const row of rows) {
          if (row.id?.toString() === rowId) return row;
          if (row.subRows) {
            const found = findSubRow(row.subRows);
            if (found) return found;
          }
        }
        return undefined;
      };

      const row = findSubRow(tableData);

      console.log('found row:', row);

      if (row && row.depth === 2) {
        const subrowId = row.id;

        if (!row.detailData || row.detailData.length === 0) {
          const additionalData = await fetchAdditionalData(subrowId);

          setTableData(prev => {
            const newData = structuredClone(prev);

            const updateRow = (rows) => {
              for (let r of rows) {
                if (r.id?.toString() === rowId) {
                  r.detailData = additionalData;
                }
                if (r.subRows) {
                  updateRow(r.subRows);
                }
              }
            };
            updateRow(newData);
            return newData;
          });
        }
      }
    }
  }
};

=========================================================================================
  import React, { useState, useRef, useCallback } from 'react';
import MaterialReactTable from 'material-react-table';

const YourTableComponent = ({ productandServiceDataTableData }) => {
  const [tableData, setTableData] = useState(productandServiceDataTableData || []);
  const [manualExpanded, setManualExpanded] = useState({}); // ✅ manual expanded control
  const [isLoading, setIsLoading] = useState(false);
  const tableInstanceRef = useRef(null);

  const fetchAdditionalData = async (subrowId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/details/${subrowId}`);
      const additionalData = await response.json();
      return additionalData;
    } catch (error) {
      console.error('Error fetching additional data:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandChange = useCallback(async (updaterOrValue) => {
    // Handle if MaterialReactTable sends a function or object
    let newExpanded;
    if (typeof updaterOrValue === 'function') {
      newExpanded = updaterOrValue(manualExpanded);
    } else {
      newExpanded = updaterOrValue;
    }

    // update manual expanded state
    setManualExpanded(newExpanded);

    // Loop over expanded rows
    for (const [rowId, isExpanded] of Object.entries(newExpanded)) {
      if (isExpanded) {
        const row = tableInstanceRef.current?.getRow(rowId);

        if (row && row.depth === 2) { // 3rd level expansion
          const subrowId = row.original.id;
          const parentId = row.original.parentId;

          // Check if already loaded
          if (!row.original.detailData || row.original.detailData.length === 0) {
            const additionalData = await fetchAdditionalData(subrowId);

            setTableData(prevData => {
              const newData = structuredClone(prevData);

              const updateRows = (rows) => {
                for (let r of rows) {
                  if (r.subRows) updateRows(r.subRows);
                  if (r.id === parentId) {
                    const targetRow = r.subRows.find(sr => sr.id === subrowId);
                    if (targetRow) {
                      targetRow.detailData = additionalData;
                    }
                  }
                }
              };
              updateRows(newData);
              return newData;
            });
          }
        }
      }
    }
  }, [manualExpanded, tableData]);

  const renderDetailPanel = useCallback(({ row }) => {
    if (row.depth !== 2) return null; // Only show for 3rd level rows

    const subrowData = row.original;

    return (
      <div style={{ padding: '1rem' }}>
        {isLoading ? (
          <div>Loading additional details...</div>
        ) : subrowData.detailData && subrowData.detailData.length > 0 ? (
          subrowData.detailData.map((item, idx) => (
            <pre key={idx} style={{ marginBottom: '0.5rem' }}>
              {JSON.stringify(item, null, 2)}
            </pre>
          ))
        ) : (
          <div>No detail data available</div>
        )}
      </div>
    );
  }, [isLoading]);

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'id',
      header: 'ID',
    },
    // your other columns if needed
  ];

  return (
    <MaterialReactTable
      columns={columns}
      data={tableData}
      getSubRows={(row) => row.subRows || []}
      renderDetailPanel={renderDetailPanel}
      onExpandedChange={handleExpandChange}
      state={{
        expanded: manualExpanded, // ✅ control expanded state manually
        isLoading,
      }}
      tableInstanceRef={tableInstanceRef}
      muiSearchTextFieldProps={{
        placeholder: 'Search all records...',
        variant: 'outlined',
      }}
    />
  );
};

export default YourTableComponent;

===============================================================================================
import React, { useState, useRef, useCallback } from 'react';
import MaterialReactTable from 'material-react-table';

const YourTableComponent = ({ productandServiceDataTableData }) => {
  const [tableData, setTableData] = useState(productandServiceDataTableData || []);
  const [expanded, setExpanded] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const tableInstanceRef = useRef(null);

  const fetchAdditionalData = async (subrowId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/details/${subrowId}`);
      const additionalData = await response.json();
      return additionalData;
    } catch (error) {
      console.error('Error fetching additional data:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandedChange = useCallback((expanded) => {
    setExpanded(expanded);

    // Get all expanded row ids
    Object.entries(expanded).forEach(async ([rowId, isExpanded]) => {
      if (isExpanded) {
        const row = tableInstanceRef.current?.getRow(rowId);

        if (row && row.depth === 2) {
          const subrowId = row.original.id;
          const parentId = row.original.parentId;

          // Check if detailData already exists
          if (!row.original.detailData || row.original.detailData.length === 0) {
            const additionalData = await fetchAdditionalData(subrowId);

            setTableData(prevData => {
              const newData = structuredClone(prevData);

              const updateRows = (rows) => {
                for (let r of rows) {
                  if (r.subRows) updateRows(r.subRows);
                  if (r.id === parentId) {
                    const targetRow = r.subRows.find(sr => sr.id === subrowId);
                    if (targetRow) {
                      targetRow.detailData = additionalData;
                    }
                  }
                }
              };
              updateRows(newData);
              return newData;
            });
          }
        }
      }
    });
  }, []);

  const renderDetailPanel = useCallback(({ row }) => {
    if (row.depth !== 2) return null;

    const subrowData = row.original;

    return (
      <div style={{ padding: '1rem' }}>
        {isLoading ? (
          <div>Loading additional details...</div>
        ) : subrowData.detailData && subrowData.detailData.length > 0 ? (
          subrowData.detailData.map((item, idx) => (
            <pre key={idx} style={{ marginBottom: '0.5rem' }}>
              {JSON.stringify(item, null, 2)}
            </pre>
          ))
        ) : (
          <div>No detail data available</div>
        )}
      </div>
    );
  }, [isLoading]);

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'id',
      header: 'ID',
    },
    // Add other columns if needed
  ];

  return (
    <MaterialReactTable
      columns={columns}
      data={tableData}
      getSubRows={(row) => row.subRows || []}
      renderDetailPanel={renderDetailPanel}
      onExpandedChange={handleExpandedChange}
      tableInstanceRef={tableInstanceRef}
      muiSearchTextFieldProps={{
        placeholder: 'Search all records...',
        variant: 'outlined',
      }}
      state={{
        expanded,
        isLoading,
      }}
    />
  );
};

export default YourTableComponent;

===============================================================
import React, { useState, useRef, useCallback } from 'react';
import MaterialReactTable from 'material-react-table';

const YourTableComponent = ({ productandServiceDataTableData }) => {
  const [tableData, setTableData] = useState(productandServiceDataTableData || []);
  const [manualExpanded, setManualExpanded] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const tableInstanceRef = useRef(null);

  // Function to fetch additional data for a specific subrow
  const fetchAdditionalData = async (subrowId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/details/${subrowId}`);
      const additionalData = await response.json();
      return additionalData;
    } catch (error) {
      console.error('Error fetching additional data:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Handle expanding a row (for third-level rows only)
  const handleExpandRow = useCallback(async ({ row, expanded }) => {
    if (expanded && row.depth === 2) { // depth 2 -> third-level
      const subrowId = row.original.id;

      if (!row.original.detailData || row.original.detailData.length === 0) {
        const additionalData = await fetchAdditionalData(subrowId);

        setTableData(prevData => {
          const newData = structuredClone(prevData); // Deep clone

          const findAndUpdate = (rows) => {
            for (const r of rows) {
              if (r.subRows) {
                findAndUpdate(r.subRows);
              }
              if (r.id === row.parentId) {
                const subSubRow = r.subRows.find(sr => sr.id === subrowId);
                if (subSubRow) {
                  subSubRow.detailData = additionalData;
                }
              }
            }
          };
          findAndUpdate(newData);
          return newData;
        });
      }
    }
  }, [fetchAdditionalData]);

  // Combine manual expand handling and dynamic fetch
  const handleExpandedChange = useCallback((updater) => {
    // Update manual expanded state
    setManualExpanded(prev => 
      typeof updater === 'function' ? updater(prev) : updater
    );

    // After updating expansion, fetch if necessary
    if (typeof updater === 'function') {
      const newExpanded = updater({});
      const expandedRowIds = Object.keys(newExpanded);

      expandedRowIds.forEach((rowId) => {
        const row = tableInstanceRef.current?.getRow(rowId);
        if (row?.depth === 2) { // Only for third level
          handleExpandRow({ row, expanded: newExpanded[rowId] });
        }
      });
    }
  }, [handleExpandRow]);

  // Render the Detail Panel when a row is expanded
  const renderDetailPanel = useCallback(({ row }) => {
    if (row.depth !== 2) return null; // Only for third level

    const subrowData = row.original;

    return (
      <div style={{ padding: '1rem' }}>
        {isLoading ? (
          <div>Loading additional details...</div>
        ) : Array.isArray(subrowData.detailData) && subrowData.detailData.length > 0 ? (
          subrowData.detailData.map((item, idx) => (
            <pre key={idx} style={{ marginBottom: '0.5rem' }}>
              {JSON.stringify(item, null, 2)}
            </pre>
          ))
        ) : (
          <div>No detail data available</div>
        )}
      </div>
    );
  }, [isLoading]);

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'id',
      header: 'ID',
    },
    // Add more columns as needed
  ];

  return (
    <MaterialReactTable
      columns={columns}
      data={tableData}
      getSubRows={(row) => row.subRows || []}
      renderDetailPanel={renderDetailPanel}
      onExpandedChange={handleExpandedChange}
      tableInstanceRef={tableInstanceRef}
      muiSearchTextFieldProps={{
        placeholder: 'Search all records...',
        variant: 'outlined',
      }}
      state={{
        expanded: manualExpanded,
        isLoading,
      }}
    />
  );
};

export default YourTableComponent;
