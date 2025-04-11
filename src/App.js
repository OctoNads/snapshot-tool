import React, { useState, useEffect, useReducer } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

// Initial state for useReducer
const initialState = {
  contractAddress: "",
  minNFTs: "",
  holderCount: "",
  result: [],
  collectionMetadata: null,
  isLoading: false,
  fetchError: "",
  showCompletion: false,
  fileFormat: "pdf",
  accessGranted: false,
  accessInput: "",
  accessError: false,
  floatingTextStyles: [],
};

// Reducer function for state management
const reducer = (state, action) => {
  switch (action.type) {
    case "SET_CONTRACT_ADDRESS":
      return { ...state, contractAddress: action.payload };
    case "SET_MIN_NFTS":
      return { ...state, minNFTs: action.payload };
    case "SET_HOLDER_COUNT":
      return { ...state, holderCount: action.payload };
    case "SET_RESULT":
      return { ...state, result: action.payload };
    case "SET_COLLECTION_METADATA":
      return { ...state, collectionMetadata: action.payload };
    case "SET_IS_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_FETCH_ERROR":
      return { ...state, fetchError: action.payload };
    case "SET_SHOW_COMPLETION":
      return { ...state, showCompletion: action.payload };
    case "SET_FILE_FORMAT":
      return { ...state, fileFormat: action.payload };
    case "SET_ACCESS_GRANTED":
      return { ...state, accessGranted: action.payload };
    case "SET_ACCESS_INPUT":
      return { ...state, accessInput: action.payload };
    case "SET_ACCESS_ERROR":
      return { ...state, accessError: action.payload };
    case "SET_FLOATING_TEXT_STYLES":
      return { ...state, floatingTextStyles: action.payload };
    default:
      return state;
  }
};

const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    contractAddress,
    minNFTs,
    holderCount,
    result,
    collectionMetadata,
    isLoading,
    fetchError,
    showCompletion,
    fileFormat,
    accessGranted,
    accessInput,
    accessError,
    floatingTextStyles,
  } = state;

  // Request notification permission on mount
  useEffect(() => {
    if (
      "Notification" in window &&
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission().catch((err) =>
        console.error("Notification permission error:", err)
      );
    }
  }, []);

  // Floating text animation setup
  useEffect(() => {
    const floatingTexts = [
      "GMONAD",
      "GOCTO",
      "GCHOG",
      "GCHOGSTAR",
      "GMOO",
      "GDAKS",
      "G10K",
      "GBLOCK",
      "GMEOW",
      "GMOPO",
      "GCANZ",
    ];

    const initialStyles = floatingTexts.map(() => ({}));
    dispatch({ type: "SET_FLOATING_TEXT_STYLES", payload: initialStyles });

    const moveFloatingTexts = () => {
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 50;
      const newStyles = floatingTexts.map(() => ({
        left: `${Math.random() * maxX}px`,
        top: `${Math.random() * maxY}px`,
        transition: "all 5s linear",
      }));
      dispatch({ type: "SET_FLOATING_TEXT_STYLES", payload: newStyles });
    };

    moveFloatingTexts();
    const interval = setInterval(moveFloatingTexts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle access code submission
  const handleAccessSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const input = accessInput.trim().toUpperCase();
    if (input === "GOCTO") {
      dispatch({ type: "SET_ACCESS_GRANTED", payload: true });
      dispatch({ type: "SET_ACCESS_ERROR", payload: false });
    } else {
      dispatch({ type: "SET_ACCESS_ERROR", payload: true });
    }
  };

  // Fetch NFT holders from backend (single page)
  const fetchNFTHolders = async (contractAddress, pageIndex = 1, pageSize = 10) => {
    const url = `/api/holders?contractAddress=${encodeURIComponent(
      contractAddress
    )}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  };

  // Fetch all holders with pagination
  const fetchAllNFTHolders = async (contractAddress, pageSize = 10) => {
    let allHolders = [];
    let metadata = null;
    let pageIndex = 1;
    const batchSize = 5;

    try {
      while (true) {
        const fetchPromises = [];
        for (let i = 0; i < batchSize && pageIndex + i <= 1000; i++) {
          fetchPromises.push(fetchNFTHolders(contractAddress, pageIndex + i, pageSize));
        }
        const batchResults = await Promise.all(fetchPromises);
        let hasMorePages = false;
        for (const result of batchResults) {
          if (!metadata) metadata = result.metadata;
          allHolders.push(...result.holders);
          if (result.total && allHolders.length < result.total) hasMorePages = true;
          else if (result.holders.length === pageSize) hasMorePages = true;
        }
        pageIndex += batchSize;
        if (!hasMorePages || fetchPromises.length < batchSize) break;
      }
      return { holders: allHolders, metadata };
    } catch (error) {
      throw new Error(`Failed to fetch holders: ${error.message}`);
    }
  };

  // Filter holders by minimum NFT count
  const filterHolders = (holders, minNFTs) => {
    return holders.filter((holder) => Number(holder.amount) > minNFTs);
  };

  // Handle form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      dispatch({ type: "SET_HOLDER_COUNT", payload: "" });
      dispatch({ type: "SET_RESULT", payload: [] });
      dispatch({ type: "SET_COLLECTION_METADATA", payload: null });
      dispatch({
        type: "SET_FETCH_ERROR",
        payload: "Invalid contract address format.",
      });
      return;
    }

    let minNFTsValue = 0;
    if (minNFTs) {
      minNFTsValue = parseInt(minNFTs, 10) - 1;
      if (isNaN(minNFTsValue) || minNFTsValue < 0) {
        alert("Please enter a valid minimum NFT count (positive integer).");
        return;
      }
    }

    dispatch({ type: "SET_IS_LOADING", payload: true });
    dispatch({ type: "SET_FETCH_ERROR", payload: "" });
    dispatch({ type: "SET_HOLDER_COUNT", payload: "" });
    dispatch({ type: "SET_RESULT", payload: [] });
    dispatch({ type: "SET_COLLECTION_METADATA", payload: null });

    try {
      const { holders, metadata } = await fetchAllNFTHolders(contractAddress);
      if (holders.length > 0) {
        const filteredHolders = filterHolders(holders, minNFTsValue);
        dispatch({
          type: "SET_HOLDER_COUNT",
          payload: `Number of Holders holding at least ${minNFTs || 1} NFT(s): ${
            filteredHolders.length
          }`,
        });
        dispatch({ type: "SET_RESULT", payload: filteredHolders });
        dispatch({ type: "SET_COLLECTION_METADATA", payload: metadata });
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Fetching Completed", {
            body: "NFT holders have been successfully fetched!",
          });
        }
        dispatch({ type: "SET_SHOW_COMPLETION", payload: true });
      } else {
        dispatch({ type: "SET_HOLDER_COUNT", payload: "Number of holders: 0" });
        dispatch({ type: "SET_RESULT", payload: [] });
        dispatch({ type: "SET_COLLECTION_METADATA", payload: null });
        dispatch({ type: "SET_SHOW_COMPLETION", payload: true });
      }
    } catch (error) {
      dispatch({ type: "SET_FETCH_ERROR", payload: error.message });
    } finally {
      dispatch({ type: "SET_IS_LOADING", payload: false });
    }
  };

  // Reset form fields
  const handleReset = () => {
    dispatch({ type: "SET_CONTRACT_ADDRESS", payload: "" });
    dispatch({ type: "SET_MIN_NFTS", payload: "" });
    dispatch({ type: "SET_HOLDER_COUNT", payload: "" });
    dispatch({ type: "SET_RESULT", payload: [] });
    dispatch({ type: "SET_COLLECTION_METADATA", payload: null });
    dispatch({ type: "SET_FETCH_ERROR", payload: "" });
  };

  // Download results as PDF or XML
  const handleDownload = () => {
    const addresses = result.map((holder) => holder.ownerAddress).filter((addr) => addr);
    if (addresses.length === 0) {
      alert("No holders to download.");
      return;
    }

    if (fileFormat === "pdf") {
      const doc = new jsPDF();
      addresses.forEach((addr, index) => {
        doc.text(addr, 10, 10 + index * 10);
      });
      doc.save("holders.pdf");
    } else if (fileFormat === "xml") {
      const xmlContent = `<holders>\n${addresses
        .map((addr) => `    <address>${addr}</address>`)
        .join("\n")}\n</holders>`;
      const blob = new Blob([xmlContent], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "holders.xml";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <div className={accessGranted ? "" : "blur-content"}>
        <header className="sticky-header">
          <img
            src="https://amethyst-worthy-gayal-734.mypinata.cloud/ipfs/bafkreiguhll5qwfac6x36v362nv2mhgl7so45dd262zpulwq7c4tfwbedq"
            alt="OctoNads Logo"
            className="header-logo"
          />
          <div className="header-title">
            <h1>SNAPSHOT TOOL</h1>
            <h2 className="subheading">(Monad Testnet)</h2>
          </div>
          <div className="header-spacer"></div>
        </header>
        <div className="container">
          {fetchError && <div className="error-message">{fetchError}</div>}
          <form onSubmit={handleFormSubmit}>
            <label htmlFor="contractAddress">NFT Contract Address:</label>
            <input
              type="text"
              id="contractAddress"
              value={contractAddress}
              onChange={(e) =>
                dispatch({ type: "SET_CONTRACT_ADDRESS", payload: e.target.value })
              }
              placeholder="e.g., 0x..."
              required
              aria-required="true"
            />
            <label htmlFor="minNFTs">Minimum NFTs (optional, default is 1):</label>
            <input
              type="number"
              id="minNFTs"
              value={minNFTs}
              onChange={(e) => dispatch({ type: "SET_MIN_NFTS", payload: e.target.value })}
              min="1"
              placeholder="Enter minimum NFT count"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : fetchError ? "Try Again" : "Find Holders"}
            </button>
            <button type="button" onClick={handleReset} disabled={isLoading}>
              Reset
            </button>
          </form>

          {collectionMetadata && (
            <div className="metadata-section">
              <h2 className="metadata-heading">Collection Details</h2>
              <div className="metadata-content">
                <div className="text-info">
                  <h3>
                    {collectionMetadata.name}
                    {collectionMetadata.verified && (
                      <img
                        src="https://amethyst-worthy-gayal-734.mypinata.cloud/ipfs/bafkreid7pkljli36nzivwmixmdul5pa44qhpcpxgrxukmkawuc3j2shb3e"
                        alt="Verified Badge"
                        className="verified-badge"
                      />
                    )}
                  </h3>
                  <p>Supply: {collectionMetadata.supply}</p>
                  {collectionMetadata.marketplaceLink && (
                    <a
                      href={collectionMetadata.marketplaceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="marketplace-link"
                    >
                      View on Marketplace
                    </a>
                  )}
                </div>
                <div className="image-and-logos">
                  <img
                    src={collectionMetadata.image}
                    alt={`${collectionMetadata.name} collection`}
                    className="collection-image"
                  />
                  <div className="social-logos">
                    {collectionMetadata.twitter && (
                      <a href={collectionMetadata.twitter} target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-twitter social-logo" aria-label="Twitter"></i>
                      </a>
                    )}
                    {collectionMetadata.discord && (
                      <a href={collectionMetadata.discord} target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-discord social-logo" aria-label="Discord"></i>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {!collectionMetadata && holderCount && (
            <p className="metadata-unavailable">
              Collection metadata not available for this contract address. Contact the OctoNads
              Team to get it uploaded.
            </p>
          )}

          {holderCount && <div id="holderCount">{holderCount}</div>}
          <div id="result">
            {result.length > 0 ? (
              Array.isArray(result) && result[0].ownerAddress ? (
                <ul>
                  {result.map((holder, index) => (
                    <li key={index}>
                      {holder.ownerAddress} - Amount: {holder.amount}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{result[0]}</p>
              )
            ) : (
              <p>Holders will appear here...</p>
            )}
          </div>

          <div id="downloadOptions">
            <label htmlFor="fileFormat">Download as:</label>
            <select
              id="fileFormat"
              value={fileFormat}
              onChange={(e) => dispatch({ type: "SET_FILE_FORMAT", payload: e.target.value })}
            >
              <option value="pdf">PDF</option>
              <option value="xml">XML</option>
            </select>
            <button onClick={handleDownload} disabled={!result.length || isLoading}>
              Download
            </button>
          </div>
        </div>

        {/* Floating texts */}
        {floatingTextStyles.map((style, index) => (
          <div key={index} className="floating-text" style={style}>
            {[
              "GMONAD",
              "GOCTO",
              "GCHOG",
              "GCHOGSTAR",
              "GMOO",
              "GDAKS",
              "G10K",
              "GBLOCK",
              "GMEOW",
              "GMOPO",
              "GCANZ",
            ][index]}
          </div>
        ))}

        <footer>
          <div className="copyright">© 2025</div>
          <div className="powered-by">Powered by OctoNads</div>
          <div className="social-icons">
            <a href="https://x.com/OctoNads" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-twitter social-logo" aria-label="Twitter"></i>
            </a>
            <a href="https://discord.com/invite/octonads" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-discord social-logo" aria-label="Discord"></i>
            </a>
          </div>
        </footer>
      </div>

      {/* Access Modal */}
      <div className="modal" style={{ display: accessGranted ? "none" : "block" }} id="accessModal">
        <div className="modal-content">
          <h2>Access Required</h2>
          <p>Please type "GOCTO" to access the snapshot tool.</p>
          <form onSubmit={handleAccessSubmit}>
            <input
              type="text"
              id="accessInput"
              value={accessInput}
              onChange={(e) => dispatch({ type: "SET_ACCESS_INPUT", payload: e.target.value })}
              placeholder="Type GOCTO"
              autoFocus
              required
              aria-required="true"
            />
            <button type="submit">Submit</button>
          </form>
          {accessError && (
            <p id="accessError" className="error-message">
              Incorrect input. Please try again.
            </p>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletion && (
        <div className="modal" id="completionModal">
          <div className="modal-content">
            <h2>Fetching Completed</h2>
            <p>NFT holders have been successfully fetched!</p>
            <button onClick={() => dispatch({ type: "SET_SHOW_COMPLETION", payload: false })}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;