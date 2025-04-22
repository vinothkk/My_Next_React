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
