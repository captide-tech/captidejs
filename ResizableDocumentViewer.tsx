// ... existing code ...
                          <div className="overflow-hidden w-0 group-hover:w-7 group-hover:border-l transition-all duration-200 bg-white flex items-center justify-center border-[#E4E6EC] pointer-events-none">
                            <div
                              className="pointer-events-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTab(tab.sourceLink);
                              }}
                            >
                              <X 
                                className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer" 
                              />
                            </div>
                          </div>
// ... existing code ...