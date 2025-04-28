// In your YourTableComponent
const {
  filteredDataProduct,
  handleSearch,
  searchTerm,
  expandedRowIds
} = useNestedDataFilter(productandServiceDataTableData, ['name']);

// Add a useEffect to trigger data loading when expanded state changes due to search
useEffect(() => {
  // Load data for any newly expanded level 3 rows
  const loadDataForExpandedRows = async () => {
    if (!expandedRowIds) return;
    
    // Find level 3 rows that need data loaded
    const findAndLoadLevel3Rows = (rows, depth = 0) => {
      for (const row of rows) {
        const isExpanded = expandedRowIds[row.id];
        
        // If this is an expanded level 2 row
        if (isExpanded && depth === 1 && row.subRows) {
          // Check its children (level 3 rows) that need data
          for (const subRow of row.subRows) {
            if (expandedRowIds[subRow.id] && 
                subRow.hasOwnProperty('detailData') && 
                (!subRow.detailData || subRow.detailData.length === 0)) {
              // Fetch and load data for this row
              fetchAdditionalData(subRow.id).then(data => {
                // Update the data in state
                setProductandServiceDataTableData(prevData => {
                  // Create a deep copy
                  const newData = JSON.parse(JSON.stringify(prevData));
                  
                  // Find and update the specific row
                  const updateRow = (rows, targetId) => {
                    for (let i = 0; i < rows.length; i++) {
                      if (rows[i].id === targetId) {
                        rows[i].detailData = data;
                        return true;
                      }
                      
                      if (rows[i].subRows && rows[i].subRows.length > 0) {
                        if (updateRow(rows[i].subRows, targetId)) {
                          return true;
                        }
                      }
                    }
                    return false;
                  };
                  
                  updateRow(newData, subRow.id);
                  return newData;
                });
              });
            }
          }
        }
        
        // Recursively check subrows
        if (row.subRows && row.subRows.length > 0) {
          findAndLoadLevel3Rows(row.subRows, depth + 1);
        }
      }
    };
    
    findAndLoadLevel3Rows(filteredDataProduct);
  };
  
  loadDataForExpandedRows();
}, [expandedRowIds, filteredDataProduct]);

// In your return statement, make sure to pass expanded state to the table
return (
  <MaterialReactTable
    columns={columns}
    data={filteredDataProduct}
    enableExpanding
    getSubRows={(row) => row.subRows || []}
    renderDetailPanel={renderDetailPanel}
    onExpandedChange={(updater) => {
      // Handle manual expansion changes
      const newExpandedState = typeof updater === 'function' 
        ? updater(expandedRowIds) 
        : updater;
      
      // Preserve current search-expanded rows
      const combinedState = {...expandedRowIds, ...newExpandedState};
      
      // Your existing manual expand handler, if any
      if (setManualExpanded) {
        setManualExpanded(combinedState);
      }
      
      // Your existing fetch data logic for manually expanded rows
      // ... (can be placed here)
    }}
    tableInstanceRef={tableInstanceRef}
    muiSearchTextFieldProps={{
      placeholder: 'Search all records...',
      variant: 'outlined',
      onChange: (e) => handleSearch(e.target.value),
      value: searchTerm,
    }}
    state={{
      expanded: expandedRowIds,  // Use expanded state from your hook
      isLoading,
    }}
  />
);
===================================================================================
const YourTableComponent = () => {
  // Keep your existing state
  const [productandServiceDataTableData, setProductandServiceDataTableData] = useState([]);
  const [manualExpanded, setManualExpanded] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const tableInstanceRef = useRef(null);
  
  // Function to fetch additional data for a specific subrow
  const fetchAdditionalData = async (subrowId) => {
    setIsLoading(true);
    try {
      // Replace with your actual API call
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
  
  // Combined handler for both your existing expand functionality and the new dynamic loading
  const handleExpandRow = useCallback(async (updater) => {
    // MaterialReactTable passes either an object or a function updater
    // We need to handle both cases
    
    // First, determine what the new expanded state will be
    let newExpandedState;
    if (typeof updater === 'function') {
      // If it's a function updater, we need to call it with the current state
      newExpandedState = updater(manualExpanded);
    } else {
      // If it's an object, that's the new state directly
      newExpandedState = updater;
    }
    
    // Find which row was newly expanded by comparing with previous state
    let expandedRowId = null;
    let isExpanded = false;
    
    // The updater might be an object with a rowId and expanded properties
    if (updater && typeof updater === 'object' && 'id' in updater) {
      expandedRowId = updater.id;
      isExpanded = updater.expanded;
    } 
    // Or we need to find which row changed in the expanded state object
    else if (newExpandedState && typeof newExpandedState === 'object') {
      for (const id in newExpandedState) {
        if (newExpandedState[id] && (!manualExpanded || !manualExpanded[id])) {
          expandedRowId = id;
          isExpanded = true;
          break;
        }
      }
    }
    
    // First, call your existing handler to maintain current functionality
    setManualExpanded(newExpandedState);
    
    // If no row was expanded or the row was collapsed, we don't need to fetch data
    if (!expandedRowId || !isExpanded) return;
    
    console.log('Row expanded:', expandedRowId);
    
    // Find the row data for the expanded row
    const findRow = (rows, id, depth = 0) => {
      for (const row of rows) {
        if (row.id === id) {
          return { row, depth };
        }
        
        if (row.subRows && row.subRows.length > 0) {
          const found = findRow(row.subRows, id, depth + 1);
          if (found) return found;
        }
      }
      return null;
    };
    
    const rowInfo = findRow(productandServiceDataTableData, expandedRowId);
    if (!rowInfo) return;
    
    const { row, depth } = rowInfo;
    
    // Check if this is a level-3 row with detailData property that needs loading
    const isLevel3 = depth === 2; // Adjust based on your actual structure
    const needsDataLoading = isLevel3 && 
                           row.hasOwnProperty('detailData') && 
                           (!row.detailData || row.detailData.length === 0);
    
    if (needsDataLoading) {
      console.log('Loading data for row:', row.id);
      
      // Fetch the data
      const additionalData = await fetchAdditionalData(row.id);
      
      // Update the state with the new data
      setProductandServiceDataTableData(prevData => {
        // Create a deep copy to avoid mutating state
        const newData = JSON.parse(JSON.stringify(prevData));
        
        // Find and update the specific row in the nested structure
        const updateRowInData = (rows, targetId) => {
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].id === targetId) {
              rows[i].detailData = additionalData;
              return true;
            }
            
            if (rows[i].subRows && rows[i].subRows.length > 0) {
              if (updateRowInData(rows[i].subRows, targetId)) {
                return true;
              }
            }
          }
          return false;
        };
        
        updateRowInData(newData, row.id);
        return newData;
      });
    }
  }, [manualExpanded, productandServiceDataTableData]);
  
  // The rest of your component remains the same
  
  return (
    <MaterialReactTable
      columns={columns}
      data={productandServiceDataTableData}
      enableExpanding
      getSubRows={(row) => row.subRows || []}
      renderDetailPanel={renderDetailPanel}
      onExpandedChange={handleExpandRow}
      tableInstanceRef={tableInstanceRef}
      muiSearchTextFieldProps={{
        placeholder: 'Search all records...',
        variant: 'outlined',
      }}
      state={{
        isLoading,
      }}
    />
  );
};
===================================================================================
  const YourTableComponent = () => {
  // Keep your existing state
  const [productandServiceDataTableData, setProductandServiceDataTableData] = useState([]);
  const [manualExpanded, setManualExpanded] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const tableInstanceRef = useRef(null);
  
  // Function to fetch additional data for a specific subrow
  const fetchAdditionalData = async (subrowId) => {
    setIsLoading(true);
    try {
      // Replace with your actual API call
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
  
  // Combined handler for both your existing expand functionality and the new dynamic loading
  const handleExpandRow = useCallback(async (expandedState) => {
    // First, call your existing handler to maintain current functionality
    setManualExpanded(expandedState);
    
    // Find which row was just expanded (if any)
    const newlyExpandedRowId = Object.keys(expandedState).find(
      key => expandedState[key] && !manualExpanded[key]
    );
    
    if (!newlyExpandedRowId) return; // No newly expanded row
    
    // Find the row data for the expanded row
    const findRowById = (rows, id, parentPath = []) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const currentPath = [...parentPath, i];
        
        if (row.id === id) {
          return { row, path: currentPath };
        }
        
        if (row.subRows && row.subRows.length > 0) {
          const result = findRowById(row.subRows, id, [...currentPath, 'subRows']);
          if (result) return result;
        }
      }
      return null;
    };
    
    const rowData = findRowById(productandServiceDataTableData, newlyExpandedRowId);
    if (!rowData) return;
    
    const { row, path } = rowData;
    
    // Check if this is a level-3 row with detailData property that needs loading
    const isLevel3 = path.length === 5; // Adjust based on your actual structure
    const needsDataLoading = isLevel3 && row.hasOwnProperty('detailData') && 
                            (!row.detailData || row.detailData.length === 0);
    
    if (needsDataLoading) {
      // Fetch the data
      const additionalData = await fetchAdditionalData(row.id);
      
      // Update the table data with the fetched details
      setProductandServiceDataTableData(prevData => {
        // Create a deep copy to avoid mutating state directly
        const newData = JSON.parse(JSON.stringify(prevData));
        
        // Navigate to the correct nested position using the path we found
        let target = newData;
        let currentPath = [];
        
        for (let i = 0; i < path.length - 1; i++) {
          currentPath.push(path[i]);
          target = target[path[i]];
          if (path[i+1] === 'subRows') {
            target = target.subRows;
            i++;
          }
        }
        
        // Update the detailData property
        target[path[path.length - 1]].detailData = additionalData;
        return newData;
      });
    }
  }, [manualExpanded, productandServiceDataTableData]);
  
  // Custom renderDetailPanel function - similar to your example
  const renderDetailPanel = useCallback(({ row }) => {
    // Determine if this is a level-3 row
    const isLevel3Row = row.depth === 2; // Adjust based on your actual structure
    
    if (isLevel3Row && row.original.hasOwnProperty('detailData')) {
      const rowData = row.original;
      
      return (
        <div>
          {!rowData.detailData || rowData.detailData.length === 0 ? (
            <div>Loading additional details...</div>
          ) : (
            <div>
              {/* Render your detail data here */}
              {Array.isArray(rowData.detailData) ? (
                <div>
                  {rowData.detailData.map((item, index) => (
                    <div key={index}>
                      <div>Customer ID: {item.customerId}</div>
                      <div>Product Family: {item.product_family}</div>
                      <div>Business Unit: {item.business_unit}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>No detail data available</div>
              )}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  }, []);
  
  // Your columns definition
  const columns = [
    // Your column definitions
  ];
  
  return (
    <MaterialReactTable
      columns={columns}
      data={productandServiceDataTableData}
      enableExpanding
      getSubRows={(row) => row.subRows || []}
      renderDetailPanel={renderDetailPanel}
      onExpandedChange={handleExpandRow}
      tableInstanceRef={tableInstanceRef}
      muiSearchTextFieldProps={{
        placeholder: 'Search all records...',
        variant: 'outlined',
      }}
      state={{
        isLoading,
      }}
    />
  );
};
=====================================================================================
Manual expand 3
const handleExpandChange = useCallback(async (updaterOrValue) => {
  let newExpanded;
  if (typeof updaterOrValue === 'function') {
    newExpanded = updaterOrValue(manualExpanded);
  } else {
    newExpanded = updaterOrValue;
  }

  setManualExpanded(newExpanded);

  // Find the last expanded row (only check newly expanded row)
  const expandedRowIds = Object.entries(newExpanded)
    .filter(([_, isExpanded]) => isExpanded)
    .map(([rowId, _]) => rowId);

  if (expandedRowIds.length === 0) {
    return; // nothing expanded
  }

  const lastExpandedRowId = expandedRowIds[expandedRowIds.length - 1];

  // Find the object inside tableData manually
  const findRowById = (rows) => {
    for (const row of rows) {
      if (row.id?.toString() === lastExpandedRowId?.toString()) {
        return row;
      }
      if (row.subRows && row.subRows.length > 0) {
        const found = findRowById(row.subRows);
        if (found) return found;
      }
    }
    return null;
  };

  const foundRow = findRowById(tableData);

  if (foundRow) {
    // Check if 'detailData' property exists and is empty
    if (Object.prototype.hasOwnProperty.call(foundRow, 'detailData') && 
        (!foundRow.detailData || foundRow.detailData.length === 0)) {
      
      try {
        const additionalData = await fetchAdditionalData(lastExpandedRowId);

        setTableData(prevData => {
          // Use the existing data and update the specific row only
          const newData = prevData.map(row => {
            if (row.id?.toString() === lastExpandedRowId?.toString()) {
              return {
                ...row,
                detailData: additionalData, // Update only the detailData property
              };
            }
            if (row.subRows) {
              // If there are subRows, update them recursively
              row.subRows = row.subRows.map(subRow => {
                if (subRow.id?.toString() === lastExpandedRowId?.toString()) {
                  return {
                    ...subRow,
                    detailData: additionalData, // Update only subrow's detailData
                  };
                }
                return subRow;
              });
            }
            return row;
          });
          return newData;
        });
      } catch (error) {
        console.error('Error fetching additional data:', error);
      }
    } else {
      console.log('Detail data already loaded or no detailData field present');
    }
  } else {
    console.warn('Row not found for rowId:', lastExpandedRowId);
  }
}, [manualExpanded, tableData]);

==================================================================================
manual expand 2
const handleExpandChange = useCallback(async (updaterOrValue) => {
  let newExpanded;
  if (typeof updaterOrValue === 'function') {
    newExpanded = updaterOrValue(manualExpanded);
  } else {
    newExpanded = updaterOrValue;
  }

  setManualExpanded(newExpanded);

  // Find the last expanded row (only check newly expanded row)
  const expandedRowIds = Object.entries(newExpanded)
    .filter(([_, isExpanded]) => isExpanded)
    .map(([rowId, _]) => rowId);

  if (expandedRowIds.length === 0) {
    return; // nothing expanded
  }

  const lastExpandedRowId = expandedRowIds[expandedRowIds.length - 1];

  // Find the object inside tableData manually
  const findRowById = (rows) => {
    for (const row of rows) {
      if (row.id?.toString() === lastExpandedRowId?.toString()) {
        return row;
      }
      if (row.subRows && row.subRows.length > 0) {
        const found = findRowById(row.subRows);
        if (found) return found;
      }
    }
    return null;
  };

  const foundRow = findRowById(tableData);

  if (foundRow) {
    // Check if 'detailData' property exists and is empty
    if (Object.prototype.hasOwnProperty.call(foundRow, 'detailData') && 
        (!foundRow.detailData || foundRow.detailData.length === 0)) {
      
      try {
        const additionalData = await fetchAdditionalData(lastExpandedRowId);

        setTableData(prevData => {
          const newData = structuredClone(prevData);

          const updateRowById = (rows) => {
            for (const row of rows) {
              if (row.id?.toString() === lastExpandedRowId?.toString()) {
                row.detailData = additionalData;
              }
              if (row.subRows && row.subRows.length > 0) {
                updateRowById(row.subRows);
              }
            }
          };

          updateRowById(newData);
          return newData;
        });
      } catch (error) {
        console.error('Error fetching additional data:', error);
      }
    } else {
      console.log('Detail data already loaded or no detailData field present');
    }
  } else {
    console.warn('Row not found for rowId:', lastExpandedRowId);
  }
}, [manualExpanded, tableData]);

============================
Manual Expand
=================================================
  const handleExpandChange = useCallback(async (updaterOrValue) => {
  let newExpanded;
  if (typeof updaterOrValue === 'function') {
    newExpanded = updaterOrValue(manualExpanded);
  } else {
    newExpanded = updaterOrValue;
  }

  // Update manual expanded state
  setManualExpanded(newExpanded);

  // Loop over expanded rows
  for (const [rowId, isExpanded] of Object.entries(newExpanded)) {
    if (isExpanded) {
      const subRowId = rowId; // This is the id we get

      // Find the object inside tableData manually
      const findRowById = (rows) => {
        for (const row of rows) {
          if (row.id?.toString() === subRowId?.toString()) {
            return row;
          }
          if (row.subRows && row.subRows.length > 0) {
            const found = findRowById(row.subRows);
            if (found) return found;
          }
        }
        return null;
      };

      const foundRow = findRowById(tableData);

      if (foundRow) {
        // Check if detailData is missing or empty
        if (!foundRow.detailData || foundRow.detailData.length === 0) {
          try {
            const additionalData = await fetchAdditionalData(subRowId);

            setTableData(prevData => {
              const newData = structuredClone(prevData);

              const updateRowById = (rows) => {
                for (const row of rows) {
                  if (row.id?.toString() === subRowId?.toString()) {
                    row.detailData = additionalData;
                  }
                  if (row.subRows && row.subRows.length > 0) {
                    updateRowById(row.subRows);
                  }
                }
              };

              updateRowById(newData);
              return newData;
            });
          } catch (error) {
            console.error('Error while fetching additional data:', error);
          }
        }
      } else {
        console.warn('Row not found for rowId:', subRowId);
      }
    }
  }
}, [manualExpanded, tableData]);

============================================
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
