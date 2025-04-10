import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const App = () => {
  const [contractAddress, setContractAddress] = useState("");
  const [minNFTs, setMinNFTs] = useState("");
  const [holderCount, setHolderCount] = useState("");
  const [result, setResult] = useState([]);
  const [collectionMetadata, setCollectionMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessInput, setAccessInput] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [floatingTextStyles, setFloatingTextStyles] = useState([]);
  const [showCompletion, setShowCompletion] = useState(false);
  const [fileFormat, setFileFormat] = useState("pdf");
  const [fetchError, setFetchError] = useState(false);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // Floating texts animation
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
    setFloatingTextStyles(initialStyles);

    const moveFloatingTexts = () => {
      const maxX = window.innerWidth - 100;
      const maxY = window.innerHeight - 50;
      const newStyles = floatingTexts.map(() => ({
        left: `${Math.random() * maxX}px`,
        top: `${Math.random() * maxY}px`,
        transition: "all 5s linear",
      }));
      setFloatingTextStyles(newStyles);
    };
    moveFloatingTexts();
    const interval = setInterval(moveFloatingTexts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Access control
  const handleAccessSubmit = () => {
    const input = accessInput.trim().toUpperCase();
    if (input === "GOCTO") {
      setAccessGranted(true);
      setAccessError(false);
    } else {
      setAccessError(true);
    }
  };

  // Fetch NFT holders from backend
  const fetchNFTHolders = async (contractAddress, pageIndex = 1, pageSize = 10) => {
    const url = `/api/holders?contractAddress=${encodeURIComponent(contractAddress)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  };

  // Fetch all holders with pagination
  const fetchAllNFTHolders = async (contractAddress, pageSize = 10) => {
    let allHolders = [];
    let metadata = null;
    let pageIndex = 1;
    const batchSize = 5;
  
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
        // Check if there are more pages (assuming API provides a 'total' field)
        if (result.total && allHolders.length < result.total) hasMorePages = true;
        else if (result.holders.length === pageSize) hasMorePages = true;
      }
      pageIndex += batchSize;
      if (!hasMorePages || fetchPromises.length < batchSize) break;
    }
    return { holders: allHolders, metadata };
  };

  // Filter holders by minimum NFT count
  const filterHolders = (holders, minNFTs) => {
    return holders.filter((holder) => Number(holder.amount) > minNFTs);
  };

  // Form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setHolderCount("");
      setResult([]);
      setCollectionMetadata(null);
      setResult(["Invalid contract address format."]);
      setFetchError(true);
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

    setIsLoading(true);
    setFetchError(false);
    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);

    try {
      const { holders, metadata } = await fetchAllNFTHolders(contractAddress);
      if (holders.length > 0) {
        const filteredHolders = filterHolders(holders, minNFTsValue);
        setHolderCount(`Number of Holders holding at least ${minNFTs || 1} amount of NFTs: ${filteredHolders.length}`);
        setResult(filteredHolders);
        setCollectionMetadata(metadata);
        if (Notification.permission === "granted") {
          new Notification("Fetching Completed", {
            body: "NFT holders have been successfully fetched!",
          });
        }
        setShowCompletion(true);
      } else {
        setHolderCount("Number of holders: 0");
        setResult([]);
        setCollectionMetadata(null);
        setShowCompletion(true);
      }
    } catch (error) {
      setHolderCount("");
      setResult([`Error: ${error.message}`]);
      setCollectionMetadata(null);
      setFetchError(true);
      if (Notification.permission === "granted") {
        new Notification("Fetching Failed", {
          body: "Failed to fetch NFT holders. Please try again.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setContractAddress("");
    setMinNFTs("");
    setHolderCount("");
    setResult([]);
    setCollectionMetadata(null);
    setFetchError(false);
  };

  // Download results
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
      {/* Blurred content */}
      <div className={accessGranted ? "" : "blur"}>
        <header className="sticky-header">
          <img
            src="https://amethyst-worthy-gayal-734.mypinata.cloud/ipfs/bafkreiguhll5qwfac6x36v362nv2mhgl7so45dd262zpulwq7c4tfwbedq"
            alt="Logo"
            className="header-logo"
          />
          <div className="header-title">
            <h1>SNAPSHOT TOOL</h1>
            <h2 className="subheading">(Monad Testnet)</h2>
          </div>
          <div className="header-spacer"></div>
        </header>
        <div className="container">
          <form onSubmit={handleFormSubmit}>
            <label htmlFor="contractAddress">NFT Contract Address:</label>
            <input
              type="text"
              id="contractAddress"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="e.g., 0x..."
              required
            />
            <label htmlFor="minNFTs">Minimum NFTs (optional, default is 1):</label>
            <input
              type="number"
              id="minNFTs"
              value={minNFTs}
              onChange={(e) => setMinNFTs(e.target.value)}
              min="1"
              placeholder="Enter minimum NFT count"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : fetchError ? "Try Again" : "Find Holders Address"}
            </button>
            <button type="button" onClick={handleReset}>
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
                        alt="Verified"
                        className="verified-badge"
                      />
                    )}
                  </h3>
                  <p>Supply: {collectionMetadata.supply}</p>
                  <a
                    href={collectionMetadata.marketplaceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="marketplace-link"
                  >
                    View on Marketplace
                  </a>
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
                        <i className="fab fa-twitter social-logo"></i>
                      </a>
                    )}
                    {collectionMetadata.discord && (
                      <a href={collectionMetadata.discord} target="_blank" rel="noopener noreferrer">
                        <i className="fab fa-discord social-logo"></i>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {!collectionMetadata && holderCount && (
            <p style={{ marginTop: "20px" }}>
              Collection metadata not available for this contract address. Contact the OctoNads Team to get Upload
            </p>
          )}

          <div id="holderCount" style={{ marginTop: "20px" }}>{holderCount}</div>
          <div id="result" style={{ marginTop: "10px" }}>
            {result.length > 0 ? (
              Array.isArray(result) && result[0].ownerAddress ? (
                <ul style={{ listStyleType: "none", padding: 0 }}>
                  {result.map((holder, index) => (
                    <li key={index} style={{ marginBottom: "5px" }}>
                      {holder.ownerAddress} - Amount: {holder.amount}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{result[0]}</p>
              )
            ) : (
              <p>Holders address will found here ...</p>
            )}
          </div>

          <div id="downloadOptions" style={{ marginTop: "20px" }}>
            <label htmlFor="fileFormat">Download as:</label>
            <select
              id="fileFormat"
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
            >
              <option value="pdf">PDF</option>
              <option value="xml">XML</option>
            </select>
            <button onClick={handleDownload}>Download</button>
          </div>
        </div>

        {/* Render floating texts */}
        {floatingTextStyles.map((style, index) => (
          <div
            key={index}
            className="floating-text"
            style={style}
          >
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
              <i className="fab fa-twitter social-logoo"></i>
            </a>
            <a href="https://discord.com/invite/octonads" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-discord social-logoo"></i>
            </a>
          </div>
        </footer>
      </div>

      {/* Access Modal */}
      {!accessGranted && (
        <div id="accessModal" className="modal" style={{ display: "block" }}>
          <div className="modal-content">
            <h2>Access Required</h2>
            <p>Please type "GOCTO" to access the snapshot tool.</p>
            <input
              type="text"
              id="accessInput"
              value={accessInput}
              onChange={(e) => setAccessInput(e.target.value)}
              placeholder="Type GOCTO"
              onKeyPress={(e) => e.key === "Enter" && handleAccessSubmit()}
            />
            <button onClick={handleAccessSubmit}>Submit</button>
            {accessError && (
              <p id="accessError" style={{ color: "red" }}>
                Incorrect input. Please try again.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {showCompletion && (
        <div id="completionModal" style={{ display: "block" }}>
          <h2>Fetching Completed</h2>
          <p>NFT holders have been successfully fetched!</p>
          <button onClick={() => setShowCompletion(false)}>OK</button>
        </div>
      )}
    </div>
  );
};

export default App;