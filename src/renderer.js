function showToast(message, type="info", duration=3000){

    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // 애니메이션
    setTimeout(()=>{
        toast.classList.add("show");
    },10);

    // 자동 제거
    setTimeout(()=>{
        toast.classList.remove("show");

        setTimeout(()=>{
            toast.remove();
        },300);

    },duration);
}



function setWorkflowButtons(enabled) {

  const ids = [
    "runSequence",
    "generatephylodynamics",
    "restartServices",
    "reinstallServices"
  ];

  ids.forEach(id => {

    const el = document.getElementById(id);
    if (!el) return;

    el.disabled = !enabled;

    if (enabled) {
      el.classList.remove("btn-disabled");
    } else {
      el.classList.add("btn-disabled");
    }

  });

}

window.addEventListener('DOMContentLoaded', () => {

    // ===============================
    // DOM 요소
    // ===============================
    const tabs = document.querySelectorAll(".tabs button");
    const pages = document.querySelectorAll(".page");

    const prefixInput = document.getElementById('prefix');
    const fastqBtn = document.getElementById('selectFastq');
    const runSequenceBtn = document.getElementById('runSequence');
    const fastqPathEl = document.getElementById('fastqPath');

    // Metadata 페이지 관련
    const fastaBtn = document.getElementById('selectFasta');
    const fastaPathEl = document.getElementById('fastaFile');
    const generateMetadataBtn = document.getElementById('generatephylodynamics');

    // 로그 관련
    const workflowStatus = document.getElementById("workflowStatus");
    const workflowProgress = document.getElementById("workflowProgress");
    const logBtn = document.getElementById("logBtn");
    const logEl = document.getElementById("log");
    const logModal = document.getElementById("logModal");

    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const daySelect = document.getElementById('daySelect');

    // 연도 채우기 (1900~현재)
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1900; y--) {
    const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    // 연도 선택 시 month/day 초기화
    yearSelect.addEventListener('change', () => {
        monthSelect.value = 'XX';
        daySelect.value = 'XX';
        monthSelect.disabled = false;
        daySelect.disabled = true;
    });

    // 월 선택 시 day 초기화
    monthSelect.addEventListener('change', () => {
        daySelect.disabled = false;
        daySelect.innerHTML = '<option value="xx">Unknown</option>';

        const month = monthSelect.value;
        const year = parseInt(yearSelect.value);

        if (month === 'XX' || isNaN(year)) return;

        // Date 객체로 해당 월 마지막 일 계산
        // 0번째 날 = 이전 달 마지막 날 → (month, 0)
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const opt = document.createElement('option');
            opt.value = String(d).padStart(2, '0');
            opt.textContent = String(d).padStart(2, '0');
            daySelect.appendChild(opt);
        }

        daySelect.value = 'XX'; // 초기 선택은 Unknown
    });


    // ===============================
    // 파라미터 객체
    // ===============================

    let metadataParams = {};
    let auspiceParams = { dataset: '', mode: 'online' };

    // ===============================
    // 메타데이터 수집
    // ===============================
    async function collectMetadata() {
        const year = yearSelect.value;   // ex: 2026
        const month = monthSelect.value; // ex: 03 or xx
        const day = daySelect.value;     // ex: 15 or xx

        let formattedDate = "";
        if (year) {
        const mm = month ? month.padStart(2, '0') : 'XX';
        const dd = day ? day.padStart(2, '0') : 'XX';
        formattedDate = `${year}-${mm}-${dd}`;
        }
        const metadata = {
            workflow: 'Phylodynamic',
            host: document.getElementById('host').value,
            genetic_exchange: document.getElementById('genetic_exchange').value,
            lineage: document.getElementById('lineage').value,
            hybrid_zone: document.getElementById('hybrid_zone').value,
            country: document.getElementById('country').value,
            province: document.getElementById('province').value,
            city: document.getElementById('city').value,
            town: document.getElementById('town').value,
            accession: document.getElementById('accession').value,
            date: formattedDate,
            db: document.getElementById('db').value,
            title: document.getElementById('title').value,
            journal: document.getElementById('journal').value,
            paper_url: document.getElementById('paper_url').value,
            fasta: document.getElementById('fastaFile').value,
            fastaType: document.getElementById('fastaType').value
        };
        return metadata;
    }

    // ===============================
    // FASTQ 선택
    // ===============================
    fastqBtn?.addEventListener('click', async () => {
    const file = await window.api.selectFastq();
    if (file) {
        fastqPathEl.value = file;
    }
    });

    // ===============================
    // FASTA 선택 (Metadata 페이지)
    // ===============================
    fastaBtn?.addEventListener('click', async () => {
    const file = await window.api.selectFasta();
    if (file) {
        fastaPathEl.value = file;
    }
    });

    // ===============================
    // Workflow 실행 (분석)
    // ===============================
    runSequenceBtn?.addEventListener('click', async () => {
        const Params = { 
            workflow: 'Sequence', 
            prefix: prefixInput.value.trim(), 
            fastq: fastqPathEl.value, 
            reference: document.getElementById('reference')?.value || "",
            variant_quality_threshold: 10,
            variant_depth_threshold: 50,
            low_cov_threshold: 5
        };
        Params.prefix = prefixInput.value;
        Params.reference = document.getElementById('reference')?.value || "";

        // 숫자 입력 값 읽기
        Params.variant_quality_threshold = Number(document.getElementById('variant_quality_threshold')?.value || 10);
        Params.variant_depth_threshold = Number(document.getElementById('variant_depth_threshold')?.value || 50);
        Params.low_cov_threshold = Number(document.getElementById('low_cov_threshold')?.value || 5);

        // 시작 메시지
        logEl.innerHTML = `<span class="msg">=== Starting workflow: ${Params.prefix} ===</span>\n`;
        //console.log("Sequence Params:", Params);

        try {
            logModal.classList.add("show");
            setWorkflowButtons(false)
            await window.api.runWorkflow(Params);
            logEl.innerHTML += `<span class="msg">\n=== Workflow finished! ===</span>\n`;
        } catch (err) {
            logEl.innerHTML += `<span class="error">\n[Error]: ${err.message}</span>\n`;
            logModal.classList.add("show"); // 오류 발생 시 모달 자동 표시
        }

        // 스크롤 항상 맨 아래
        logEl.scrollTop = logEl.scrollHeight;
    });

    // ===============================
    // Generate Metadata + Nextstrain 실행
    // ===============================
    generateMetadataBtn?.addEventListener('click', async () => {
    metadataParams = await collectMetadata();

    if (!metadataParams.fasta) {
        alert('FASTA 파일을 선택하세요!');
        return;
    }

    // 시작 메시지
    logEl.innerHTML = `<span class="msg">\n=== Starting Nextstrain workflow ===</span>\n`;

    try {
        logModal.classList.add("show");
        setWorkflowButtons(false)
        await window.api.runWorkflow(metadataParams);
        logEl.innerHTML += `<span class="msg">\n=== Nextstrain workflow finished! ===</span>\n`;
    } catch (err) {
        logEl.innerHTML += `<span class="error">\n[Error]: ${err.message}</span>\n`;
        logModal.classList.add("show"); // 에러 발생 시 모달 자동 표시
    }

    // 스크롤 항상 맨 아래
    logEl.scrollTop = logEl.scrollHeight;
    });

  // ===============================
  // Worker 로그 수신
  // ===============================
  window.api.onLog((data) => {
    console.log(data)
    switch (data.type) {

        // ================= 로그 =================
        case "msg":
            logEl.innerHTML += `<span class="cmd">${data.data}</span>\n`;
            logEl.scrollTop = logEl.scrollHeight;
            break;

        case "error":
            logEl.innerHTML += `<span class="error">${data.data}</span>\n`;
            logEl.scrollTop = logEl.scrollHeight;
            logModal.classList.add("show");
            break;

        // ================= Progress =================
        case "progress": {

        const { current, total, title } = data.data;

        const percent =
            Math.floor((current / total) * 100);

        // progress width 변경
        workflowProgress.style.width = percent + "%";

        // 실행중 상태
        workflowProgress.classList.add("running");

        // 상태 텍스트
        workflowStatus.textContent =
            `${current}/${total} ${title}`;

        break;
        }


        // ================= Error =================
        case "error":
            workflowProgress.classList.remove("running");
            workflowProgress.classList.add("error");

            workflowStatus.textContent = "Error";
            break;


        // ================= End =================
        case "end":
            workflowProgress.style.width = "100%";

            workflowProgress.classList.remove("running");
            workflowProgress.classList.add("done");

            workflowStatus.textContent = "Completed";
            break;

        case "work end":
            setWorkflowButtons(true)
            showToast(data.data)
            break;

        case "toast":
            showToast(data.data)
            break;
    }

    });


    const modeSelect = document.getElementById("visualizationMode");
    const iframe = document.getElementById("auspiceFrame");

    modeSelect.addEventListener("change", async () => {

        if (modeSelect.value === "online") {
            iframe.src = "https://auspice.us";
            return;
        }

        if (modeSelect.value === "offline") {

            const url = "http://localhost:4000";

            try {
                const res = await fetch(url, { method: "HEAD" });
                if (!res.ok) throw new Error("Offline server not responding");

                iframe.src = url;

            } catch (err) {
                console.warn("[Auspice] Offline server unreachable, restarting Docker...");

                const Params = { workflow: 'restart' };
                logEl.innerHTML = `<span class="msg">=== Offline server unreachable, restarting Docker Compose services ===</span>\n`;
                try {
                    logModal.classList.add("show");
                    await window.api.runWorkflow(Params);
                    logEl.innerHTML += `<span class="msg">=== Restart finished ===</span>\n`;
                    setTimeout(() => {
                        iframe.src = url;
                    }, 3000);

                } catch (e) {
                    logEl.innerHTML += `<span class="error">[Error]: ${e.message}</span>\n`;
                    logModal.classList.add("show");
                }
                logEl.scrollTop = logEl.scrollHeight;
            }

        }

    });

    const refreshBtn = document.getElementById("refreshIframe");
    refreshBtn.addEventListener("click", () => {
        iframe.src = iframe.src;   // iframe만 리프레시
    });

    const restartBtn = document.getElementById("restartServices");
    const reinstallBtn = document.getElementById("reinstallServices");

    restartBtn.addEventListener("click", async () => {
        const Params = { workflow: 'restart' };
        logEl.innerHTML = `<span class="msg">=== Restarting Docker Compose services ===</span>\n`;
        try {
            logModal.classList.add("show");
            setWorkflowButtons(false)
            await window.api.runWorkflow(Params);
            logEl.innerHTML += `<span class="msg">=== Restart finished ===</span>\n`;
        } catch (err) {
            logEl.innerHTML += `<span class="error">[Error]: ${err.message}</span>\n`;
            logModal.classList.add("show");
        }
        logEl.scrollTop = logEl.scrollHeight;
    });

    reinstallBtn.addEventListener("click", async () => {
        const Params = { workflow: 'reinstall' };
        logEl.innerHTML = `<span class="msg">=== Reinstalling Docker Compose services ===</span>\n`;
        try {
            logModal.classList.add("show");
            setWorkflowButtons(false)
            await window.api.runWorkflow(Params);
            logEl.innerHTML += `<span class="msg">=== Reinstall finished ===</span>\n`;
        } catch (err) {
            logEl.innerHTML += `<span class="error">[Error]: ${err.message}</span>\n`;
            logModal.classList.add("show");
        }
        logEl.scrollTop = logEl.scrollHeight;
    });

    // progress bar 클릭 시 로그 열기
  logBtn.addEventListener("click", () => {logModal.classList.add("show");});

    // 딤 클릭 시 로그 닫기
  logModal.addEventListener("click", (e) => {
    if (e.target === logModal) {
        logModal.classList.remove("show");
    }
  });


  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("openResult")) {
        await window.api.openFolder();
    }
  });

  // ===============================
  // SPA 탭 전환
  // ===============================
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      pages.forEach(p => p.style.display = 'none');
      const pageDiv = document.getElementById(page + 'Page');
      if (pageDiv) pageDiv.style.display = 'block';
    });
  });

  // ===============================
  // 초기 페이지 표시
  // ===============================
  if (pages.length > 0) {
    pages.forEach(p => p.style.display = 'none');
    pages[0].style.display = 'block';
  }

});