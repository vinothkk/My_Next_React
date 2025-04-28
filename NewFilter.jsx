
New Code added ---Apr 28- 2025-------

    import React, { useState, useCallback, useMemo, useRef } from 'react';

// Utility function to escape special characters for RegExp
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom Hook: useNestedDataFilter
const useNestedDataFilter = (initialData, searchFields = ['name']) => {
    // Store the current search term
    const [searchTerm, setSearchTerm] = useState('');
    
    // Use a ref to store the cached regex to avoid recreating it on each render
    const regexRef = useRef(null);
    
    // Function to highlight text based on the search term - memoized to prevent recreation
    const highlightText = useCallback((text, term) => {
        if (!term) return text; // Return original text if no search term
        if (text === null || typeof text === 'undefined') return ''; // Handle null/undefined input

        const textStr = String(text); // Ensure text is a string
        
        // Use or create regex from the ref
        if (!regexRef.current || regexRef.current.source !== `(${escapeRegExp(term)})`) {
            // Only create a new regex if the term changed
            const escapedSearchTerm = escapeRegExp(term);
            regexRef.current = new RegExp(`(${escapedSearchTerm})`, 'gi');
        }
        
        const regex = regexRef.current;
        
        // Simple approach for short strings - test if there's a match first
        if (textStr.length < 100 && !regex.test(textStr)) {
            // Reset lastIndex since test() advances it
            regex.lastIndex = 0;
            return textStr;
        }
        
        // Reset lastIndex to start search from beginning
        regex.lastIndex = 0;
        
        const result = [];
        let lastIndex = 0;
        let match;
        
        // Use exec in a loop for better browser compatibility than matchAll
        while ((match = regex.exec(textStr)) !== null) {
            const start = match.index;
            const matchedString = match[0];
            
            // Add text segment before the current match
            if (start > lastIndex) {
                result.push(textStr.slice(lastIndex, start));
            }
            
            // Add the highlighted match segment
            result.push(<mark key={`${start}-${lastIndex}`}>{matchedString}</mark>);
            lastIndex = start + matchedString.length;
            
            // Prevent infinite loops for zero-length matches
            if (match.index === regex.lastIndex) {
                regex.lastIndex++;
            }
        }
        
        // Add any remaining text after the last match
        if (lastIndex < textStr.length) {
            result.push(textStr.slice(lastIndex));
        }
        
        // If no matches were found, result array will be empty, return original text
        return result.length > 0 ? result : textStr;
    }, []);

    // Memoize the core filtering logic
    const filterData = useCallback((term, dataToSearch) => {
        // Cache objects
        const expanded = {}; // Stores IDs of expanded rows
        const matchCache = new Map(); // Caches matching results
        const parentsMap = new Map(); // Maps child to parent
        
        // Early return if no search term
        if (!term || !term.trim()) {
            return { filtered: dataToSearch, expanded: {} };
        }
        
        const termLower = term.toLowerCase();
        
        // Build parent-child relationships - memoized for performance
        const buildRelationships = (items, parentId = null, depth = 0) => {
            if (!items || !Array.isArray(items)) return;
            
            for (const item of items) {
                if (!item || !item.id) continue;
                
                // Store parent relationship
                if (parentId) {
                    parentsMap.set(item.id, parentId);
                }
                
                // Process children recursively (but limit depth to avoid stack overflow)
                if (item.subRows && Array.isArray(item.subRows) && depth < 100) {
                    buildRelationships(item.subRows, item.id, depth + 1);
                }
            }
        };
        
        // Build the relationship map once
        buildRelationships(dataToSearch);
        
        // Function to expand all parents
        const expandAllParents = (itemId) => {
            let parentId = parentsMap.get(itemId);
            while (parentId) {
                expanded[parentId] = true;
                parentId = parentsMap.get(parentId);
            }
        };
        
        // Check if an item matches directly
        const itemMatchesDirectly = (item) => {
            if (!item) return false;
            
            return searchFields.some(field => {
                if (!item[field]) return false;
                return String(item[field]).toLowerCase().includes(termLower);
            });
        };
        
        // Check if an item or its descendants match
        const checkItemAndDescendants = (item) => {
            if (!item || !item.id) return false;
            
            // Return cached result if available
            if (matchCache.has(item.id)) {
                return matchCache.get(item.id);
            }
            
            // Check direct match
            const directMatch = itemMatchesDirectly(item);
            
            // Check descendants
            let descendantsMatch = false;
            
            if (item.subRows && Array.isArray(item.subRows)) {
                // Check each child and cache the result
                for (const subItem of item.subRows) {
                    if (checkItemAndDescendants(subItem)) {
                        descendantsMatch = true;
                        // No need to check remaining children if one matches
                        if (!directMatch) break;
                    }
                }
            }
            
            const matches = directMatch || descendantsMatch;
            
            // Expand logic
            if (matches) {
                if (descendantsMatch) {
                    // If descendants match, expand this row
                    expanded[item.id] = true;
                }
                
                // Expand all parent rows
                expandAllParents(item.id);
            }
            
            // Cache the result
            matchCache.set(item.id, matches);
            return matches;
        };
        
        // Process items to include only matching ones with highlighting
        const processItems = (items) => {
            if (!items || !Array.isArray(items)) return [];
            
            return items
                .filter(item => checkItemAndDescendants(item))
                .map(item => {
                    // Create a shallow copy with a new subRows array (if needed)
                    const newItem = { ...item };
                    
                    // Highlight matching field text
                    searchFields.forEach(field => {
                        if (newItem[field]) {
                            newItem[field] = highlightText(String(item[field]), term);
                        }
                    });
                    
                    // Process subRows if they exist
                    if (item.subRows && Array.isArray(item.subRows)) {
                        newItem.subRows = processItems(item.subRows);
                    }
                    
                    return newItem;
                });
        };
        
        // Apply the filtering
        const filtered = processItems(dataToSearch);
        
        return { filtered, expanded };
    }, [searchFields, highlightText]);

    // Memoize the filtered data and expansion state
    const { filtered: filteredDataProduct, expanded: expandedRowIds } = useMemo(() => {
        return filterData(searchTerm, initialData);
    }, [filterData, searchTerm, initialData]);

    // Handler to update the search term
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
    }, []);

    // Return values needed by the component
    return {
        filteredDataProduct,  // The filtered data with highlights
        handleSearch,         // Function to call when search changes
        searchTerm,           // Current search term
        expandedRowIds        // Object with row IDs that should be expanded
    };
};

export default useNestedDataFilter;
    -----------------------------------------------------------
import React, { useState, useCallback, useMemo } from 'react';

// Utility function to escape special characters for RegExp
function escapeRegExp(string) {
    // $& means the whole matched string
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom Hook: useNestedDataFilter
const useNestedDataFilter = (initialData, searchFields = ['name']) => {
    // Store the current search term
    const [searchTerm, setSearchTerm] = useState('');

    // Function to highlight text based on the search term
    const highlightText = useCallback((text, term) => {
        if (!term) return text; // Return original text if no search term
        if (text === null || typeof text === 'undefined') return ''; // Handle null/undefined input

        const textStr = String(text); // Ensure text is a string
        const escapedSearchTerm = escapeRegExp(term);
        // Using 'gi' for global, case-insensitive match
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
        const result = [];
        let lastIndex = 0;

        // Check if matchAll is supported (ES2020)
        if (typeof textStr.matchAll !== 'function') {
            console.warn("String.prototype.matchAll() not supported. Highlighting may be limited.");
            // Provide a simple fallback or just return the text
            const index = textStr.toLowerCase().indexOf(term.toLowerCase());
             if (index === -1) return textStr;
             // Basic highlighting (first match only)
             return [
                 textStr.substring(0, index),
                 <mark key={`${index}-match`}>{textStr.substring(index, index + term.length)}</mark>,
                 textStr.substring(index + term.length)
             ];
        }

        // Use matchAll to find all occurrences
        for (const match of textStr.matchAll(regex)) {
            const start = match.index;
            const matchedString = match[0]; // The actual substring that matched

            // Add text segment before the current match
            if (start > lastIndex) {
                result.push(textStr.slice(lastIndex, start));
            }
            // Add the highlighted match segment
            // Use index and matched string for a more stable key
            result.push(<mark key={`${start}-${matchedString}`}>{matchedString}</mark>);
            lastIndex = start + matchedString.length;
        }

        // Add any remaining text after the last match
        if (lastIndex < textStr.length) {
            result.push(textStr.slice(lastIndex));
        }

        // If no matches were found, result array will be empty, return original text
        return result.length > 0 ? result : textStr;
    }, []);

    // Memoize the core filtering logic
    const filterData = useCallback((term, dataToSearch) => {
        const expanded = {}; // Stores IDs of parent rows that should be expanded because a child matched
        const matchCache = new Map(); // Caches matching results for performance
        const parentsMap = new Map(); // Track parent-child relationships
        const uniquePathsMap = new Map(); // Store unique path IDs for each row

        // If no search term, return the original data and empty expansion set
        if (!term) return { filtered: dataToSearch, expanded: {} };

        const termLower = term.toLowerCase();

        // Pre-process the data to build unique path IDs and parent-child relationships
        const buildUniquePathsAndRelationships = (items, parentPath = null, level = 0) => {
            if (!items || !Array.isArray(items)) return;
            
            items.forEach((item, index) => {
                if (!item || !item.id) return;
                
                // Create truly unique path ID for this item that includes full ancestry
                const itemPath = parentPath 
                    ? `${parentPath}/${item.id}-${index}` 
                    : `root/${index}-${item.id}`;
                
                // Store this unique path
                uniquePathsMap.set(item, itemPath);
                
                // Store parent relationship
                if (parentPath) {
                    parentsMap.set(itemPath, parentPath);
                }
                
                // Process children recursively
                if (item.subRows && Array.isArray(item.subRows)) {
                    buildUniquePathsAndRelationships(item.subRows, itemPath, level + 1);
                }
            });
        };
        
        // Build the unique paths and parent-child relationship map
        buildUniquePathsAndRelationships(dataToSearch);

        // Function to expand all parents recursively
        const expandAllParents = (itemPath) => {
            let currentPath = itemPath;
            
            while (currentPath) {
                expanded[currentPath] = true;
                currentPath = parentsMap.get(currentPath);
            }
        };

        // Recursive function to check if an item or any descendants match the search
        const itemOrDescendantsMatch = (item) => {
            if (!item) return false;
            
            // Get unique path for this item
            const itemPath = uniquePathsMap.get(item);
            if (!itemPath) return false;

            // Use itemPath as cache key
            if (matchCache.has(itemPath)) {
                return matchCache.get(itemPath);
            }

            // Check if any field in current item matches the search term
            const directMatch = searchFields.some(field =>
                item[field] && String(item[field]).toLowerCase().includes(termLower)
            );

            // Check descendants for matches
            let hasMatchingDescendant = false;
            if (item.subRows && Array.isArray(item.subRows)) {
                hasMatchingDescendant = item.subRows.some(subItem => 
                    itemOrDescendantsMatch(subItem)
                );
            }

            // Result: true if direct match or any descendant matches
            const result = directMatch || hasMatchingDescendant;
            
            // If this item matches or has matching descendants, expand all parent rows
            if (result) {
                // If matching descendants, expand this row
                if (hasMatchingDescendant) {
                    expanded[itemPath] = true;
                }
                
                // Expand all parent rows
                const parentPath = parentsMap.get(itemPath);
                if (parentPath) {
                    expandAllParents(parentPath);
                }
            }

            // Cache result for this item
            matchCache.set(itemPath, result);
            return result;
        };

        // Process the data to filter and highlight matches
        const filterStructure = (items) => {
            if (!items || !Array.isArray(items)) return [];

            return items
                .filter(item => itemOrDescendantsMatch(item))
                .map(item => {
                    // Create a shallow copy to avoid mutating the original
                    const itemCopy = { ...item };

                    // Highlight matching text in each searchable field
                    searchFields.forEach(field => {
                        if (itemCopy[field]) {
                            itemCopy[field] = highlightText(String(item[field]), term);
                        }
                    });

                    // Process subRows if they exist
                    if (itemCopy.subRows && Array.isArray(itemCopy.subRows)) {
                        itemCopy.subRows = filterStructure(itemCopy.subRows);
                    }

                    return itemCopy;
                });
        };

        // Apply the filtering process starting from top level
        const filtered = filterStructure(dataToSearch);

        // Convert our path-based expanded IDs to match the format needed by Material React Table
        const expandedForTable = {};
        
        // Process expanded paths to match Material React Table's expected format
        Object.keys(expanded).forEach(path => {
            // For Material React Table, we need to extract the row ID from our path
            // The path format is 'root/0-id' or 'parentPath/id-index'
            const parts = path.split('/');
            const lastPart = parts[parts.length - 1];
            
            // Extract the row ID part - we'll use this for MRT's expanded state
            // This is a compromise - we're assuming MRT's getRowId returns something 
            // we can derive from our path
            const rowIdMatch = lastPart.match(/(\d+)-(\d+)/);
            if (rowIdMatch) {
                const index = rowIdMatch[1];
                const id = rowIdMatch[2];
                // Use a format that hopefully matches your MRT getRowId
                expandedForTable[`${index}-${id}`] = true;
            }
        });

        return { filtered, expanded: expandedForTable };
    }, [searchFields, highlightText]);

    // Memoize the filtered data and expansion state
    const { filtered: filteredDataProduct, expanded: expandedRowIds } = useMemo(() => {
        return filterData(searchTerm, initialData);
    }, [filterData, searchTerm, initialData]);

    // Handler to update the search term
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
    }, []);

    // Return values needed by the component
    return {
        filteredDataProduct,  // The filtered data with highlights
        handleSearch,         // Function to call when search changes
        searchTerm,           // Current search term
        expandedRowIds        // Object with row IDs that should be expanded
    };
};

export default useNestedDataFilter;
=====================Above code for avoding duplicate id=============
import React, { useState, useCallback, useMemo } from 'react';

// Utility function to escape special characters for RegExp
function escapeRegExp(string) {
    // $& means the whole matched string
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom Hook: useNestedDataFilter
const useNestedDataFilter = (initialData, searchFields = ['name']) => {
    // Store the current search term
    const [searchTerm, setSearchTerm] = useState('');

    // Function to highlight text based on the search term
    const highlightText = useCallback((text, term) => {
        if (!term) return text; // Return original text if no search term
        if (text === null || typeof text === 'undefined') return ''; // Handle null/undefined input

        const textStr = String(text); // Ensure text is a string
        const escapedSearchTerm = escapeRegExp(term);
        // Using 'gi' for global, case-insensitive match
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
        const result = [];
        let lastIndex = 0;

        // Check if matchAll is supported (ES2020)
        if (typeof textStr.matchAll !== 'function') {
            console.warn("String.prototype.matchAll() not supported. Highlighting may be limited.");
            // Provide a simple fallback or just return the text
            const index = textStr.toLowerCase().indexOf(term.toLowerCase());
             if (index === -1) return textStr;
             // Basic highlighting (first match only)
             return [
                 textStr.substring(0, index),
                 <mark key={`${index}-match`}>{textStr.substring(index, index + term.length)}</mark>,
                 textStr.substring(index + term.length)
             ];
        }

        // Use matchAll to find all occurrences
        for (const match of textStr.matchAll(regex)) {
            const start = match.index;
            const matchedString = match[0]; // The actual substring that matched

            // Add text segment before the current match
            if (start > lastIndex) {
                result.push(textStr.slice(lastIndex, start));
            }
            // Add the highlighted match segment
            // Use index and matched string for a more stable key
            result.push(<mark key={`${start}-${matchedString}`}>{matchedString}</mark>);
            lastIndex = start + matchedString.length;
        }

        // Add any remaining text after the last match
        if (lastIndex < textStr.length) {
            result.push(textStr.slice(lastIndex));
        }

        // If no matches were found, result array will be empty, return original text
        return result.length > 0 ? result : textStr;
    }, []);

    // Memoize the core filtering logic
    const filterData = useCallback((term, dataToSearch) => {
        const expanded = {}; // Stores IDs of parent rows that should be expanded because a child matched
        const matchCache = new Map(); // Caches matching results for performance { rowId: boolean }
        const parentsMap = new Map(); // Track parent-child relationships

        // If no search term, return the original data and empty expansion set
        if (!term) return { filtered: dataToSearch, expanded: {} };

        const termLower = term.toLowerCase();

        // Pre-process the data to build parent-child relationships and row ID mappings
        // This helps us properly expand all parents when a child matches
        const buildParentRelationships = (items, parentId = null) => {
            if (!items || !Array.isArray(items)) return;
            
            items.forEach(item => {
                if (!item.id) return;
                
                // Store parent relationship
                if (parentId) {
                    parentsMap.set(item.id, parentId);
                }
                
                // Process children recursively
                if (item.subRows && Array.isArray(item.subRows)) {
                    buildParentRelationships(item.subRows, item.id);
                }
            });
        };
        
        // Build the parent-child relationship map
        buildParentRelationships(dataToSearch);

        // Function to expand all parents recursively
        const expandAllParents = (itemId) => {
            let currentId = itemId;
            
            while (currentId) {
                expanded[currentId] = true;
                currentId = parentsMap.get(currentId);
            }
        };

        // Recursive function to check if an item or any descendants match the search
        const itemOrDescendantsMatch = (item) => {
            if (!item || !item.id) return false;

            // Use item.id as cache key
            if (matchCache.has(item.id)) {
                return matchCache.get(item.id);
            }

            // Check if any field in current item matches the search term
            const directMatch = searchFields.some(field =>
                item[field] && String(item[field]).toLowerCase().includes(termLower)
            );

            // Check descendants for matches
            let hasMatchingDescendant = false;
            if (item.subRows && Array.isArray(item.subRows)) {
                hasMatchingDescendant = item.subRows.some(subItem => 
                    itemOrDescendantsMatch(subItem)
                );
            }

            // Result: true if direct match or any descendant matches
            const result = directMatch || hasMatchingDescendant;
            
            // If this item matches or has matching descendants, expand all parent rows
            if (result) {
                // If matching descendants, expand this row
                if (hasMatchingDescendant) {
                    expanded[item.id] = true;
                }
                
                // Expand all parent rows
                expandAllParents(parentsMap.get(item.id));
            }

            // Cache result for this item
            matchCache.set(item.id, result);
            return result;
        };

        // Process the data to filter and highlight matches
        const filterStructure = (items) => {
            if (!items || !Array.isArray(items)) return [];

            return items
                .filter(item => itemOrDescendantsMatch(item))
                .map(item => {
                    // Create a shallow copy to avoid mutating the original
                    const itemCopy = { ...item };

                    // Highlight matching text in each searchable field
                    searchFields.forEach(field => {
                        if (itemCopy[field]) {
                            itemCopy[field] = highlightText(String(item[field]), term);
                        }
                    });

                    // Process subRows if they exist
                    if (itemCopy.subRows && Array.isArray(itemCopy.subRows)) {
                        itemCopy.subRows = filterStructure(itemCopy.subRows);
                    }

                    return itemCopy;
                });
        };

        // Apply the filtering process starting from top level
        const filtered = filterStructure(dataToSearch);

        return { filtered, expanded };
    }, [searchFields, highlightText]);

    // Memoize the filtered data and expansion state
    const { filtered: filteredDataProduct, expanded: expandedRowIds } = useMemo(() => {
        return filterData(searchTerm, initialData);
    }, [filterData, searchTerm, initialData]);

    // Handler to update the search term
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
    }, []);

    // Return values needed by the component
    return {
        filteredDataProduct,  // The filtered data with highlights
        handleSearch,         // Function to call when search changes
        searchTerm,           // Current search term
        expandedRowIds        // Object with row IDs that should be expanded
    };
};

export default useNestedDataFilter;
======================================================

not working in second level child so we added above code
======================================

import React, { useState, useCallback, useMemo } from 'react';

// Utility function to escape special characters for RegExp
function escapeRegExp(string) {
    // $& means the whole matched string
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom Hook: useNestedDataFilter
const useNestedDataFilter = (initialData, searchFields = ['name']) => {
    // Store the current search term
    const [searchTerm, setSearchTerm] = useState('');

    // Function to highlight text based on the search term
    // It wraps matched parts in <mark> tags, returning an array of strings/JSX elements
    const highlightText = useCallback((text, term) => {
        if (!term) return text; // Return original text if no search term
        if (text === null || typeof text === 'undefined') return ''; // Handle null/undefined input

        const textStr = String(text); // Ensure text is a string
        const escapedSearchTerm = escapeRegExp(term);
        // Using 'gi' for global, case-insensitive match
        const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
        const result = [];
        let lastIndex = 0;

        // Check if matchAll is supported (ES2020)
        if (typeof textStr.matchAll !== 'function') {
            console.warn("String.prototype.matchAll() not supported. Highlighting may be limited.");
            // Provide a simple fallback or just return the text
            const index = textStr.toLowerCase().indexOf(term.toLowerCase());
             if (index === -1) return textStr;
             // Basic highlighting (first match only)
             return [
                 textStr.substring(0, index),
                 <mark key={`${index}-match`}>{textStr.substring(index, index + term.length)}</mark>,
                 textStr.substring(index + term.length)
             ];
        }

        // Use matchAll to find all occurrences
        for (const match of textStr.matchAll(regex)) {
            const start = match.index;
            const matchedString = match[0]; // The actual substring that matched

            // Add text segment before the current match
            if (start > lastIndex) {
                result.push(textStr.slice(lastIndex, start));
            }
            // Add the highlighted match segment
            // Use index and matched string for a more stable key
            result.push(<mark key={`${start}-${matchedString}`}>{matchedString}</mark>);
            lastIndex = start + matchedString.length;
        }

        // Add any remaining text after the last match
        if (lastIndex < textStr.length) {
            result.push(textStr.slice(lastIndex));
        }

        // If no matches were found, result array will be empty, return original text
        return result.length > 0 ? result : textStr;

    }, []); // escapeRegExp is defined outside, stable

    // Memoize the core filtering logic
    const filterData = useCallback((term, dataToSearch) => {
        const expanded = {}; // Stores IDs of parent rows that should be expanded because a child matched
        const matchCache = new Map(); // Caches matching results for performance { cacheKey: boolean }

        // If no search term, return the original data and empty expansion set
        if (!term) return { filtered: dataToSearch, expanded: {} };

        const termLower = term.toLowerCase();

        // Recursive function to check if an item or any of its descendants match the search term
        const itemOrDescendantsMatch = (item, parentId = null, index = 0, parentKey = null) => {
            if (!item) return false; // Skip null/undefined items

            // Generate composite row ID matching getRowId format
            const rowKey = parentKey 
                ? `${parentKey}-${index}-${item.id}` 
                : `${index}-${item.id}`;

            // Generate a cache key: use rowKey
            const cacheKey = rowKey;

            // Return cached result if available
            if (matchCache.has(cacheKey)) {
                return matchCache.get(cacheKey);
            }

            // Check direct match: Does any specified field in the item include the search term?
            const directMatch = searchFields.some(field =>
                item[field] && String(item[field]).toLowerCase().includes(termLower)
            );

            // If direct match found, cache and return true immediately
            if (directMatch) {
                matchCache.set(cacheKey, true);
                return true;
            }

            // Check descendants (subRows): Does any subRow (or its descendants) match?
            let hasMatchingDescendant = false;
            if (item.subRows && Array.isArray(item.subRows)) {
                hasMatchingDescendant = item.subRows.some((subItem, subIndex) =>
                    // Recursively call with subItem, passing current rowKey as the new parentKey
                    itemOrDescendantsMatch(subItem, item.id, subIndex, rowKey)
                );
            }

            // Final result for this item: true if direct match OR descendant match
            const result = directMatch || hasMatchingDescendant;

            // If a descendant matched (and not the item itself directly), mark the parent row for expansion
            if (hasMatchingDescendant) {
                expanded[rowKey] = true;
                
                // Also expand all parent rows up the chain if there's a parentKey
                if (parentKey) {
                    expanded[parentKey] = true;
                }
            }

            // Cache the final result for this item
            matchCache.set(cacheKey, result);
            return result;
        };

        // Recursive function to filter the nested structure and apply highlighting
        const filterStructure = (items, parentId = null, parentKey = null) => {
            if (!items || !Array.isArray(items)) return []; // Handle empty or non-array inputs

            return items
                // First, filter the items based on whether they or their descendants match
                .filter((item, index) => itemOrDescendantsMatch(item, parentId, index, parentKey))
                // Then, map over the matched items to create copies and process/highlight them
                .map((item, index) => {
                    // Create a shallow copy to avoid mutating the original data structure
                    const itemCopy = { ...item };
                    
                    // Calculate the unique row ID matching the format in getRowId
                    const rowKey = parentKey 
                        ? `${parentKey}-${index}-${item.id}` 
                        : `${index}-${item.id}`;

                    // Highlight the search term within the specified fields of the current item
                    searchFields.forEach(field => {
                        if (itemCopy[field]) { // Check if the field exists on the item
                            // Apply highlighting - use original item's value for accurate highlighting
                            itemCopy[field] = highlightText(String(item[field]), term);
                        }
                    });

                    // Handle deeper nesting: Recursively filter and highlight subRows
                    if (itemCopy.subRows && Array.isArray(itemCopy.subRows)) {
                        // Pass the rowKey as the parentKey for the recursive call
                        itemCopy.subRows = filterStructure(itemCopy.subRows, item.id, rowKey);
                        
                        // If we have matching descendants, add this row to expanded
                        if (itemCopy.subRows.length > 0) {
                            expanded[rowKey] = true;
                        }
                    }

                    return itemCopy; // Return the processed (potentially highlighted) copy
                });
        };

        // Apply the filtering process starting from the top level of the data
        const filtered = filterStructure(dataToSearch);

        // Return the filtered data and the set of IDs for rows that need expansion
        return { filtered, expanded };

    }, [searchFields, highlightText]); // Dependencies: searchFields array and highlightText function


    // Memoize the final filtered data product and expansion state
    // This recalculates only when filterData function, searchTerm, or initialData changes
    const { filtered: filteredDataProduct, expanded: expandedRowIds } = useMemo(() => {
        // Execute the memoized filterData function
        return filterData(searchTerm, initialData);
        // Dependencies that trigger recalculation
    }, [filterData, searchTerm, initialData]);


    // Memoized handler function to update the search term state
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        // Dependency: setSearchTerm (stable function from useState)
    }, [setSearchTerm]); // Usually safe to omit setSearchTerm, but explicit is fine

    // Return the necessary values for the component using this hook
    return {
        filteredDataProduct,  // The filtered (and highlighted) data structure
        handleSearch,         // Function to call when the search input changes
        searchTerm,           // The current search term state
        expandedRowIds        // Object indicating which rows (by ID) should be expanded
    };
};

export default useNestedDataFilter;
